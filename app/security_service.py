"""Bezpieczeństwo (v60, etap 0 społeczności) – szczegóły w docs/BEZPIECZENSTWO.md.

- rate_limit(): limity prób w bazie (tabela rate_limits), wspólne dla wszystkich workerów;
- client_ip() / is_https(): za tunelem Cloudflare i nginx (CF-Connecting-IP, CF-Visitor, X-Forwarded-*);
- cookie_secure(): flaga Secure ciasteczka sesji (COOKIE_SECURE=auto|1|0, domyślnie auto = gdy żądanie przyszło po HTTPS);
- security_headers(): nagłówki dodawane do każdej odpowiedzi portalu (magazyn ma swój odpowiednik w esn_magazyn/app.py).
"""
import json
import os
import random
import time

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

import models

TRUST_PROXY = os.getenv("TRUST_PROXY", "1") != "0"     # portal działa za nginx (+ Cloudflare); 0 = ignoruj nagłówki proxy


def client_ip(request: Request) -> str:
    if TRUST_PROXY:
        cf = request.headers.get("cf-connecting-ip")
        if cf:
            return cf.strip()[:64]
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()[:64]
        xr = request.headers.get("x-real-ip")
        if xr:
            return xr.strip()[:64]
    return (request.client.host if request.client else "?")[:64]


def is_https(request: Request) -> bool:
    if request.url.scheme == "https":
        return True
    if TRUST_PROXY:
        if "https" in (request.headers.get("x-forwarded-proto") or "").lower():
            return True
        try:
            return json.loads(request.headers.get("cf-visitor") or "{}").get("scheme") == "https"
        except Exception:
            return False
    return False


def cookie_secure(request: Request) -> bool:
    mode = (os.getenv("COOKIE_SECURE", "auto") or "auto").strip().lower()
    if mode in ("1", "true", "yes"):
        return True
    if mode in ("0", "false", "no"):
        return False
    return is_https(request)


RATE_MSG = "Zbyt wiele prób. Spróbuj ponownie za chwilę."


def rate_limit(db: Session, key: str, limit: int, window: int, commit: bool = True) -> None:
    """Okno stałe: najwyżej `limit` zdarzeń na `window` sekund dla klucza. Przekroczenie → HTTP 429."""
    now = int(time.time())
    key = key[:200]
    row = db.get(models.RateLimit, key)
    if row is None:
        row = models.RateLimit(key=key, window_start=now, count=0)
        db.add(row)
    elif now - row.window_start >= window:
        row.window_start, row.count = now, 0
    row.count += 1
    over = row.count > limit
    if random.random() < 0.01:                      # sprzątanie starych wpisów
        db.query(models.RateLimit).filter(models.RateLimit.window_start < now - 2 * 86400).delete(synchronize_session=False)
    if commit:
        db.commit()
    if over:
        retry = max(1, window - (now - row.window_start))
        raise HTTPException(status_code=429, detail=RATE_MSG, headers={"Retry-After": str(retry)})


def rate_reset(db: Session, key: str) -> None:
    row = db.get(models.RateLimit, key[:200])
    if row is not None:
        db.delete(row)
        db.commit()


# Nagłówki bezpieczeństwa. CSP egzekwowany tylko w bezpiecznym zakresie (ramki, base, object, form) – szablon ma
# jeszcze atrybuty onclick i skrypty inline; pełna polityka działa na razie w trybie raportowania (konsola przeglądarki).
CSP_ENFORCED = "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'"
CSP_REPORT_ONLY = ("default-src 'self'; "
                   "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; "
                   "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; "
                   "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
                   "img-src 'self' data: blob: https:; connect-src 'self' http://localhost:* http://127.0.0.1:*; "
                   "frame-src 'self' blob: data:; worker-src 'self' blob:")


def security_headers(request: Request, response) -> None:
    h = response.headers
    h.setdefault("X-Content-Type-Options", "nosniff")
    h.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
    h.setdefault("X-Frame-Options", "SAMEORIGIN")
    h.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    h.setdefault("Content-Security-Policy", CSP_ENFORCED)
    if (response.headers.get("content-type") or "").startswith("text/html"):
        h.setdefault("Content-Security-Policy-Report-Only", CSP_REPORT_ONLY)
    if is_https(request):
        h.setdefault("Strict-Transport-Security", "max-age=15552000")
