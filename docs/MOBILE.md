# Układ mobilny (v25)

Zasady (portal `app/static/mobile.css`, magazyn `app/esn_magazyn/static/mobile.css`):
- Plik ładowany **jako ostatni**, reguły tylko w `@media (max-width: 820px)`; desktop bez zmian.
- Nawigacja: dolny pasek zakładek `.tabbar` (60 px + safe-area). Portal: Start, Wiedza, Projekty, Komponenty, Narzędzia; konto w menu na górnym pasku (`#navAccBtn`).
  Magazyn: Portal, Komponenty, Projekty, Kategorie (szuflada `#sidebar` + `#sb-backdrop`), AI.
- Panele szczegółów i AI w magazynie: pełny ekran (z-index nad paskiem), blokada przewijania tła.
- Cele dotyku ≥ 40 px, czcionki ≥ 11 px, pola formularzy 16 px (brak zoomu iOS).
- Kolory wyłącznie ze zmiennych motywu. Filtry katalogu zwijane z licznikiem aktywnych.
- Zmieniając CSS podbij `?v=` w `<link>`.

Test: `app/tests/test_mobile.py` (okablowanie) + ręcznie Playwright (Pixel 5, 393 px).
