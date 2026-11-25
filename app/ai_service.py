"""Asystent AI: jedna bramka dla całej platformy (portal, magazyn, kolejne moduły).

Zasady:
- Użytkownik bez własnego klucza korzysta z klucza systemowego z dziennym limitem (AI_DAILY_LIMIT_USER, domyślnie 15).
- Użytkownik z własnym kluczem (BYOK) nie ma limitu; klucz jest zaszyfrowany (Fernet) i nigdy nie wraca do przeglądarki.
- Adresy dostawców dla kluczy użytkowników są STAŁE (brak własnego URL po stronie serwera, żeby nie dało się skierować
  serwera na adresy wewnętrzne – SSRF). Modele lokalne (Ollama, LM Studio) wywołuje przeglądarka użytkownika bezpośrednio.
- Tylko biblioteka standardowa + cryptography (jest już w obrazie przez python-jose[cryptography]).
"""
import base64
import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timezone

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import text

try:
    from zoneinfo import ZoneInfo
    _TZ = ZoneInfo("Europe/Warsaw")
except Exception:  # brak bazy stref czasowych w obrazie – licz dzień wg UTC
    _TZ = timezone.utc

# ── Dostawcy dla kluczy użytkowników (adresy stałe) ──────────────────────────────────────────────
PROVIDERS = {
    "gemini":     {"name": "Google Gemini",   "kind": "gemini",    "model": "gemini-2.0-flash",
                   "url": "https://generativelanguage.googleapis.com/v1beta"},
    "openai":     {"name": "OpenAI",          "kind": "openai",    "model": "gpt-4o-mini",
                   "url": "https://api.openai.com/v1"},
    "anthropic":  {"name": "Anthropic Claude", "kind": "anthropic", "model": "claude-haiku-5-5",
                   "url": "https://api.anthropic.com/v1"},
    "openrouter": {"name": "OpenRouter",      "kind": "openai",    "model": "openrouter/auto",
                   "url": "https://openrouter.ai/api/v1"},
    "groq":       {"name": "Groq",            "kind": "openai",    "model": "llama-3.3-70b-versatile",
                   "url": "https://api.groq.com/openai/v1"},
}
GEMINI_FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"]

MODEL_RE = re.compile(r"^[A-Za-z0-9._:/\-]{1,80}$")
KEY_RE = re.compile(r"^[\x21-\x7e]{8,300}$")          # drukowalne ASCII bez spacji
MAX_SYSTEM = 20000
MAX_MSGS = 12
MAX_MSG_CHARS = 2000
COOLDOWN_SECONDS = int(os.environ.get("AI_COOLDOWN_SECONDS", "5"))
TIMEOUT = 40


class AIError(Exception):
    def __init__(self, message, status=500):
        super().__init__(message)
        self.message, self.status = message, status


# ── Szyfrowanie kluczy ───────────────────────────────────────────────────────────────────────────
def _fernet():
    secret = os.environ.get("AI_KEY_SECRET") or ("esn-ai::" + os.environ.get("JWT_SECRET_KEY", "brak_klucza_w_env_file!"))
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest()))


def encrypt_key(key):
    return _fernet().encrypt(key.encode()).decode()


def decrypt_key(token):
    try:
        return _fernet().decrypt(token.encode()).decode()
    except (InvalidToken, ValueError):
        raise AIError("Nie można odczytać zapisanego klucza (zmienił się sekret szyfrujący). Wpisz klucz ponownie.", 400)


def key_hint(key):
    return "…" + key[-4:]


# ── Konfiguracja systemowa (klucz właściciela platformy) ─────────────────────────────────────────
def system_config():
    """Dostawca serwerowy z .env: gemini (domyślnie) | anthropic | openai_compat (np. Twoja Ollama / LM Studio)."""
    prov = os.environ.get("AI_PROVIDER", "gemini").lower()
    if prov == "lmstudio":
        prov = "openai_compat"
    cfg = {"provider": prov, "gemini_key": os.environ.get("GEMINI_API_KEY", ""),
           "anthropic_key": os.environ.get("ANTHROPIC_API_KEY", ""),
           # adres bazowy (…/v1); stary LM_STUDIO_URL z pełną ścieżką …/chat/completions też działa
           "compat_url": re.sub(r"/chat/completions/?$", "", os.environ.get("AI_SERVER_OPENAI_URL") or os.environ.get("LM_STUDIO_URL", "")),
           "compat_model": os.environ.get("AI_SERVER_OPENAI_MODEL", "local-model"),
           "compat_key": os.environ.get("AI_SERVER_OPENAI_KEY", "")}
    if prov == "gemini":
        cfg["configured"] = bool(cfg["gemini_key"])
        cfg["name"] = "Google Gemini (klucz platformy)"
    elif prov == "anthropic":
        cfg["configured"] = bool(cfg["anthropic_key"])
        cfg["name"] = "Anthropic Claude (klucz platformy)"
    else:
        cfg["configured"] = bool(cfg["compat_url"])
        cfg["name"] = "Model platformy"
    return cfg


def daily_limit(user, has_own_key):
    """None = bez limitu."""
    if has_own_key or user.role == "admin":
        return None
    try:
        return max(0, int(os.environ.get("AI_DAILY_LIMIT_USER", "15")))
    except ValueError:
        return 15


def today():
    return datetime.now(_TZ).date()


# ── Limity: rezerwacja miejsca atomowo w bazie (bez wyścigów przy równoległych zapytaniach) ─────────
def reserve(db, user, limit):
    """Zwiększa licznik, jeśli limit nie jest wyczerpany. Zwraca True/False."""
    d = today()
    if limit is None:
        res = db.execute(text(
            "UPDATE users SET ai_requests_today = CASE WHEN last_ai_request_date = :d THEN ai_requests_today + 1 ELSE 1 END, "
            "last_ai_request_date = :d WHERE id = :id"), {"d": d, "id": user.id})
    else:
        res = db.execute(text(
            "UPDATE users SET ai_requests_today = CASE WHEN last_ai_request_date = :d THEN ai_requests_today + 1 ELSE 1 END, "
            "last_ai_request_date = :d WHERE id = :id AND (last_ai_request_date IS DISTINCT FROM :d OR ai_requests_today < :lim)"),
            {"d": d, "id": user.id, "lim": limit})
    db.commit()
    return res.rowcount == 1


def refund(db, user):
    db.execute(text("UPDATE users SET ai_requests_today = GREATEST(ai_requests_today - 1, 0) WHERE id = :id AND last_ai_request_date = :d"),
               {"id": user.id, "d": today()})
    db.commit()


def used_today(user):
    return (user.ai_requests_today or 0) if user.last_ai_request_date == today() else 0


_last_call = {}


def check_cooldown(user_id):
    now = time.monotonic()
    wait = COOLDOWN_SECONDS - (now - _last_call.get(user_id, -1e9))
    if wait > 0:
        raise AIError(f"Poczekaj {int(wait) + 1} s przed kolejnym pytaniem.", 429)
    _last_call[user_id] = now


# ── Wywołania dostawców ──────────────────────────────────────────────────────────────────────────
def _post(url, headers, payload, timeout=TIMEOUT):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), method="POST",
                                 headers={"Content-Type": "application/json", **headers})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:400]
        msg = body
        try:
            j = json.loads(body)
            err = j.get("error", j)
            msg = err.get("message", body) if isinstance(err, dict) else str(err)
        except ValueError:
            pass
        raise AIError(msg or f"Błąd HTTP {e.code}", e.code) from None
    except urllib.error.URLError as e:
        raise AIError(f"Brak połączenia z dostawcą AI: {e.reason}", 502) from None
    except (TimeoutError, OSError):
        raise AIError("Dostawca AI nie odpowiedział na czas.", 504) from None


def _gemini(key, model, system, messages):
    contents = [{"role": "user", "parts": [{"text": system}]}, {"role": "model", "parts": [{"text": "Rozumiem, jestem gotowy."}]}]
    for m in messages:
        contents.append({"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]})
    models = [model] if model else GEMINI_FALLBACK_MODELS
    last = None
    for mdl in models:
        try:
            j = _post(f"{PROVIDERS['gemini']['url']}/models/{mdl}:generateContent", {"x-goog-api-key": key},
                      {"contents": contents, "generationConfig": {"maxOutputTokens": 4096, "temperature": 0.7}})
            return j["candidates"][0]["content"]["parts"][0]["text"]
        except AIError as e:
            if e.status in (404, 429, 503) and len(models) > 1:
                last = e
                continue
            raise
        except (KeyError, IndexError):
            raise AIError("Gemini zwrócił pustą odpowiedź (możliwe zablokowanie treści).", 502)
    raise last


def _openai(base, key, model, system, messages, extra_headers=None):
    msgs = [{"role": "system", "content": system}] + [{"role": m["role"], "content": m["content"]} for m in messages]
    headers = {"Authorization": "Bearer " + key} if key else {}
    headers.update(extra_headers or {})
    j = _post(base.rstrip("/") + "/chat/completions", headers,
              {"model": model, "messages": msgs, "temperature": 0.7, "max_tokens": 2048, "stream": False})
    try:
        return j["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise AIError("Dostawca zwrócił nieoczekiwaną odpowiedź.", 502)


def _anthropic(key, model, system, messages):
    j = _post(PROVIDERS["anthropic"]["url"] + "/messages", {"x-api-key": key, "anthropic-version": "2023-06-01"},
              {"model": model, "max_tokens": 1536, "system": system,
               "messages": [{"role": m["role"], "content": m["content"]} for m in messages]})
    try:
        return j["content"][0]["text"]
    except (KeyError, IndexError):
        raise AIError("Dostawca zwrócił nieoczekiwaną odpowiedź.", 502)


def call_user_provider(provider, key, model, system, messages):
    p = PROVIDERS[provider]
    if p["kind"] == "gemini":
        return _gemini(key, model or None, system, messages)      # bez własnego modelu: łańcuch modeli zapasowych
    model = model or p["model"]
    if p["kind"] == "anthropic":
        return _anthropic(key, model, system, messages)
    extra = {"HTTP-Referer": "https://esn.rs-projects.ovh", "X-Title": "ESN Platform"} if provider == "openrouter" else None
    return _openai(p["url"], key, model, system, messages, extra)


def call_system_provider(cfg, system, messages):
    if cfg["provider"] == "gemini":
        return _gemini(cfg["gemini_key"], None, system, messages), "Google Gemini"
    if cfg["provider"] == "anthropic":
        return _anthropic(cfg["anthropic_key"], "claude-haiku-5-5", system, messages), "Anthropic Claude"
    try:
        return _openai(cfg["compat_url"], cfg["compat_key"], cfg["compat_model"], system, messages), "Model platformy"
    except AIError as e:
        if cfg["gemini_key"] and e.status in (502, 504):      # Twój komputer wyłączony → awaryjnie Gemini
            return _gemini(cfg["gemini_key"], None, system, messages), "Google Gemini (zapasowy)"
        raise


# ── Walidacja wejścia ────────────────────────────────────────────────────────────────────────────
def clean_messages(raw):
    out = []
    for m in (raw or [])[-MAX_MSGS:]:
        role = m.get("role") if isinstance(m, dict) else None
        content = str(m.get("content", ""))[:MAX_MSG_CHARS].strip() if isinstance(m, dict) else ""
        if role not in ("user", "assistant") or not content:
            continue
        if out and out[-1]["role"] == role:                 # dostawcy wymagają naprzemienności
            out[-1]["content"] += "\n" + content
        else:
            out.append({"role": role, "content": content})
    while out and out[0]["role"] != "user":
        out.pop(0)
    if not out or out[-1]["role"] != "user":
        raise AIError("Brak pytania użytkownika.", 400)
    return out


def complete(db, user, system, messages):
    """Pełna ścieżka: wybór klucza → limit → wywołanie → rozliczenie. Zwraca dict dla API."""
    messages = clean_messages(messages)
    system = str(system or "")[:MAX_SYSTEM]
    own = bool(user.ai_key_enc and user.ai_provider in PROVIDERS)
    cfg = None
    if not own:
        cfg = system_config()
        if not cfg["configured"]:
            raise AIError("Asystent AI nie jest skonfigurowany na tym serwerze. Możesz dodać własny klucz w Profilu.", 503)
    check_cooldown(user.id)
    limit = daily_limit(user, own)
    if not reserve(db, user, limit):
        raise AIError(f"Wykorzystano dzienny limit ({limit} zapytań). Wróci jutro; możesz też podać własny klucz API w Profilu.", 429)
    try:
        if own:
            reply = call_user_provider(user.ai_provider, decrypt_key(user.ai_key_enc), user.ai_model, system, messages)
            label = f"{PROVIDERS[user.ai_provider]['name']} (Twój klucz)"
        else:
            reply, label = call_system_provider(cfg, system, messages)
    except Exception:
        refund(db, user)                                    # nieudane zapytanie nie zużywa limitu
        raise
    db.refresh(user)
    return {"reply": reply, "provider": label, **status(user)}


def status(user):
    own = bool(user.ai_key_enc and user.ai_provider in PROVIDERS)
    limit = daily_limit(user, own)
    used = used_today(user)
    return {"limit": limit, "used": used, "remaining": None if limit is None else max(limit - used, 0),
            "own_key": own, "own_provider": user.ai_provider if own else None, "own_model": (user.ai_model or "") if own else "",
            "key_hint": user.ai_key_hint if own else None,
            "server_configured": system_config()["configured"]}
