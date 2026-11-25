# Asystent AI: limity, własny klucz, model lokalny

Jedna bramka w portalu (`app/ai_service.py`, endpointy `/api/ai/*`) obsługuje wszystkie moduły. Magazyn buduje tylko kontekst
(stan magazynu) i woła bramkę; kolejne moduły (np. Wiedza, edytor schematów) robią to samo.

## Trzy sposoby korzystania

| Tryb | Gdzie liczone | Limit | Gdzie ustawić |
|---|---|---|---|
| Klucz platformy (domyślny) | serwer, klucz z `.env` | `AI_DAILY_LIMIT_USER` (15/dobę), admin bez limitu | – |
| Własny klucz API (BYOK) | serwer → dostawca | brak (koszt po stronie użytkownika) | Profil → Asystent AI |
| Model lokalny (Ollama, LM Studio…) | przeglądarka → komputer użytkownika | brak, serwer nie widzi zapytań | Profil → Asystent AI (per urządzenie) |

Dostawcy dla własnych kluczy: Google Gemini, OpenAI, Anthropic Claude, OpenRouter, Groq. Adresy są **stałe w kodzie** (nie da się
podać własnego URL po stronie serwera – ochrona przed SSRF). Model można podać ręcznie, pusty = domyślny dostawcy.

## Limity
- Licznik w tabeli `users` (`ai_requests_today`, `last_ai_request_date`), doba wg czasu Europe/Warsaw.
- Rezerwacja miejsca jest jednym atomowym `UPDATE` (równoległe zapytania nie przekroczą limitu). Nieudane zapytanie zwraca zarezerwowane miejsce.
- Przerwa między pytaniami: `AI_COOLDOWN_SECONDS` (domyślnie 5; w pamięci procesu).
- Limity w kodzie są jedynym źródłem prawdy; dla przyszłych poziomów (np. konto wspierające) wystarczy rozszerzyć `ai_service.daily_limit()`.

## Klucze użytkowników
- Szyfrowane Fernet; sekret z `AI_KEY_SECRET` (zalecane osobna wartość), a gdy go brak – pochodna `JWT_SECRET_KEY`.
  **Zmiana sekretu unieważnia zapisane klucze** (użytkownik wpisuje je ponownie, aplikacja pokazuje czytelny komunikat).
- Klucz nigdy nie wraca do przeglądarki (API zwraca tylko końcówkę „…1234”), nie trafia do logów ani do odpowiedzi `/api/users/me`.

## Konfiguracja serwera (`.env`)
```
AI_PROVIDER=gemini            # gemini | anthropic | openai_compat (Twoja Ollama / LM Studio; stare „lmstudio” też działa)
GEMINI_API_KEY=...
# openai_compat:
AI_SERVER_OPENAI_URL=http://192.168.0.108:11434/v1   # Ollama; stary LM_STUDIO_URL z końcówką /chat/completions też jest rozpoznawany
AI_SERVER_OPENAI_MODEL=llama3.1:8b
AI_DAILY_LIMIT_USER=15
AI_KEY_SECRET=...             # openssl rand -hex 32
```
Gdy `openai_compat` nie odpowiada (komputer wyłączony), a jest `GEMINI_API_KEY`, bramka przechodzi awaryjnie na Gemini.
Magazyn łączy się z portalem pod `PORTAL_INTERNAL_URL` (domyślnie `http://web:8000`, nazwa usługi z docker-compose).

## Model lokalny użytkownika (Ollama)
Zapytania wysyła przeglądarka (`static/ai-local.js`, identyczna kopia w magazynie), bo serwer nie dosięgnie `localhost` użytkownika.
1. Ollama z modelem: `ollama run llama3.1:8b`.
2. Zezwolenie dla strony: zmienna `OLLAMA_ORIGINS=https://esn.rs-projects.ovh` (na czas prób `*`), restart Ollamy.
3. Profil → Asystent AI → „Model lokalny”: adres (domyślnie `http://localhost:11434`), nazwa modelu, „Testuj połączenie”.
LM Studio: serwer lokalny z włączonym CORS, adres zwykle `http://localhost:1234`.
Uwagi: z HTTPS przeglądarka dopuszcza `http://localhost`, ale blokuje `http://192.168…`; nowe wersje Chrome mogą zapytać o zgodę na dostęp do sieci lokalnej.
Lokalny kontekst (stan magazynu) trafia tylko do modelu użytkownika.

## Endpointy
`GET /api/ai/status` · `PUT|DELETE /api/users/me/ai-settings` · `POST /api/ai/test` (próba własnym kluczem, bez zużycia limitu) ·
`POST /api/ai/complete` (bramka: `system` + `messages`, ≤12 wiadomości po ≤2000 znaków). Magazyn: `/api/ai/chat`, `/api/ai/provider`, `/api/ai/context`.

## Dla nowych modułów
Zbuduj prompt systemowy po swojej stronie i wywołaj `POST /api/ai/complete` z tokenem użytkownika – limity, klucze i dostawcy już działają.
Teksty interfejsu ustawień są w jednym obiekcie `T` w `static/ai-settings.js` (gotowe pod tłumaczenie PL/EN).
Testy: `app/tests/test_ai.py` (atrapa dostawcy, bez sieci).

## Link do karty komponentu (v24)
Komponent magazynu zaimportowany z katalogu platformy ma `catalog_item_id`. W szczegółach komponentu jest przycisk „Karta na platformie”
(`/#components/<id>`; portal otwiera wtedy pełną kartę z katalogu). Kontekst AI zawiera dla takich komponentów pole `KARTA: [nazwa](/#components/ID)`,
a odpowiedź modelu jest wyświetlana z klikalnymi linkami **wyłącznie** w tym wzorcu (DOM przez `createElement`/`textContent`, bez `innerHTML`;
inne linki i HTML zostają zwykłym tekstem).
