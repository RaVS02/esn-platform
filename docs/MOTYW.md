# Motyw jasny / ciemny

## Jak działa
- Tryby: **auto** (domyślnie, według ustawienia systemu `prefers-color-scheme`), **jasny**, **ciemny**. Przycisk w pasku nawigacji przełącza je po kolei
  (auto → jasny → ciemny → auto). Wybór jest zapamiętany w `localStorage` (klucz `esn-theme`); w trybie auto motyw zmienia się razem z systemem.
- `app/static/theme.js` ładuje się synchronicznie w `<head>` i ustawia `data-theme="light|dark"` na `<html>` przed pierwszym malowaniem (bez błysku).
  API: `ESNTheme.mode()`, `.effective()`, `.set('auto|light|dark')`, `.cycle()`; zdarzenie `esn-theme` na `document` (`detail: {mode, theme}`).
- Paleta jest w `app/static/style.css`: blok `:root` (ciemna), `:root[data-theme="light"]` (jasna).

## Zasady dla nowego kodu
1. Kolory tylko przez zmienne: `var(--bg)`, `--bg2`, `--card`, `--border`, `--text`, `--text2`, `--text3`, `--accent`, `--green`, `--orange`, `--red`, `--purple`.
2. Półprzezroczyste tła: `rgba(var(--accent-rgb), .1)` (analogicznie `--green-rgb`, `--orange-rgb`, `--red-rgb`, `--purple-rgb`, `--bg-rgb`, `--card-rgb`, `--text-rgb`, `--text2-rgb`).
3. Tekst w kolorze statusu na jasnym tle: `--green-t`, `--orange-t`, `--red-t`, `--purple-t`, `--info-t` (ciemniejsze w jasnym motywie, lepszy kontrast).
4. Nie tworzymy osobnych wersji jasnych i ciemnych treści ani widgetów: zmienia się tylko paleta.
5. Nowa zmienna koloru musi być zdefiniowana w obu paletach (pilnuje tego `tests/test_theme.py`).

## Ciemne „wyspy”
Bloki kodu (`.code-block`, `.kn-code`, `.kn-codewrap`) zostają ciemne także w jasnym motywie: dostają ciemne zmienne
(reguła `:root[data-theme="light"] :is(...)` w `style.css`).

## Widgety (etap 2)
- Widgety działają w odizolowanym iframe i mają kolory wpisane jako `#hex` (także te zapisane już w bazie). Przy renderowaniu `knowledge.js`
  podmienia znane kolory (paleta `WIDGET_PAL`: [ciemny, jasny]) na zmienne `--w-text`, `--w-border`, `--w-acc`, `--w-ok`, `--w-bad`, `--w-warn`… i ustawia je w iframe
  według motywu. Zmiana motywu dociera do widgetów przez `postMessage` (także do tych, które jeszcze się nie załadowały, dzięki `loading="lazy"` i zdarzeniu `load`).
- **Nowe widgety:** używaj kolorów z `WIDGET_PAL` (lub od razu `var(--w-…)`). Kolor spoza palety zostanie bez zmian w obu motywach. Test `test_widget_palette_complete`
  pilnuje, żeby widgety z archiwum używały tylko kolorów z palety.
- Rysunki `figure` (SVG): przy renderowaniu kolory starej ciemnej palety (`#e0eaf5`, `#8a9ab5`, `#00d4ff`, `rgba(0,212,255,…)` itd.) są podmieniane na zmienne motywu
  (`FIG_HEX` w `knowledge.js`), więc schematy z pilotażu czytają się w jasnym motywie. Nowe rysunki najlepiej tworzyć od razu ze zmiennymi (`var(--text)`, `var(--accent)`…) lub `currentColor`.
- Widgety ze starej palety (np. ADC z pilotażu) dostają te same zmienne dzięki aliasom `WIDGET_ALIAS`.

## Magazyn i galeria pinoutów (etap 2)
- Magazyn (Flask) ma własny CSS z tymi samymi paletami i własną kopię `theme.js` (`app/esn_magazyn/static/theme.js`, identyczna jak `app/static/theme.js`: pilnuje tego test).
  Portal i magazyn są pod jedną domeną, więc wybór motywu (`localStorage`, klucz `esn-theme`) jest wspólny. Przycisk jest w pasku magazynu.
- Galeria pinoutów (`static/pinout-demo.html`) ładuje `theme.js` i ma przełącznik. W jasnym motywie poprawiono kontrast numerów pinów, zaznaczeń, padu (DAP/EP) i chipów kategorii.
- Ikony przełącznika to wbudowane SVG (strony bez Font Awesome, np. galeria pinoutów, też je pokazują). Pliki w `pinout-demo.html` mają numery wersji (`?v=`), żeby przeglądarka nie trzymała starego CSS.
- Czcionka nagłówków (`--display`): **Space Grotesk** zamiast Syne (portal, magazyn).

## Poprawka przy okazji
Podgląd w edytorze Wiedzy miał `max-height` i układ kolumnowy typu flex: bloki z `overflow: hidden` (widgety, kod) kurczyły się do ~2 px,
co wyglądało jak nachodzące na siebie widgety. Dodano `.kn-body > * { flex-shrink: 0 }`.

## Do zrobienia
- Edytor schematów: jasny motyw (etap 11 edytora) i zestaw ikon; razem z integracją (README 10.x). Magazyn dostanie wtedy te same ikony co edytor.
- Etykiety przełącznika po wprowadzeniu tłumaczeń (PL/EN).

## Magazyn: zależności
`app/esn_magazyn/requirements.txt` musi zawierać wszystko, co importuje `app.py`. Brak `flasgger` powodował pętlę restartów kontenera po przebudowie obrazu (`ModuleNotFoundError`). Dodano `flasgger==0.9.7.1`.
