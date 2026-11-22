/* Treść zakładki „Instrukcja” w panelu redakcji.
 * Sekcje: { id, title, md } – md renderowane tym samym rendererem co artykuły (zapis §§§ = ```).
 * Przykłady: { title, src } – pokazywane jako kod + wynik na żywo.
 */
(function (global) {
  function F(s) { return s.replace(/§§§/g, "```"); }

  var SECTIONS = [
    { id: "start", title: "1. Jak to działa", md: F(
      ":::summary W skrócie\n" +
      "- **Treść** to artykuł, lekcja kursu albo „niezbędnik” (krótka ściągawka).\n" +
      "- Piszesz w **markdownie** i wstawiasz gotowe **bloki** (przyciski nad polem treści). Po prawej widać **podgląd na żywo**.\n" +
      "- **Redaktor** zapisuje szkic i wysyła go do przeglądu. **Administrator** zatwierdza (publikuje) albo odrzuca z komentarzem.\n" +
      "- Opublikowana treść, którą edytujesz, nie znika: zmiany czekają jako *wersja oczekująca*, a publicznie widać starą wersję do zatwierdzenia.\n" +
      ":::\n\n" +
      "Statusy: **Szkic** (tylko Ty i admin), **Do przeglądu** (zablokowana dla redaktora do decyzji), **Odrzucona** (zobacz komentarz i popraw), **Opublikowana**.\n") },

    { id: "pierwsza", title: "2. Pierwsza treść krok po kroku", md: F(
      "1. **+ Nowa treść** → wybierz *Typ* (artykuł / lekcja kursu / niezbędnik) i *Poziom*.\n" +
      "2. Wpisz **Tytuł**, krótki **Opis** (widać go na liście) i do 8 **tagów**.\n" +
      "3. Pisz w polu treści. Przyciski nad nim wstawiają gotowe bloki w miejscu kursora.\n" +
      "4. **Zapisz** (tworzy szkic). Dopiero po zapisie możesz wgrywać **obrazy**.\n" +
      "5. Sprawdź podgląd, także na telefonie. Potem **Wyślij do przeglądu**.\n" +
      "6. Lekcja kursu: wybierz *Kurs* i *Pozycję* (kolejność lekcji; kursy zakłada administrator w zakładce „Kursy”).\n") },

    { id: "bloki", title: "3. Bloki – składanie artykułu z klocków", intro: F(
      "Blok zaczyna się linią `:::nazwa Tytuł` i kończy samotną linią `:::`. Bloków **nie zagnieżdżamy** (blok w bloku nie zadziała). Wszystko poza blokami to zwykły markdown: nagłówki `##`, listy, **pogrubienia**, `kod`, tabele, linki.\n"),
      examples: [
        { title: "Podsumowanie (na początku artykułu)", src: ":::summary Szybkie podsumowanie\n- ADC zamienia napięcie na liczbę\n- 12 bitów to 4096 poziomów\n:::" },
        { title: "Uwagi: note / info / warn / danger / ok", src: ":::warn Uwaga\nGPIO34–39 ESP32 są tylko wejściami.\n:::\n\n:::danger Krytyczne\nNie podawaj 5 V na pin 3,3 V.\n:::\n\n:::ok Rozwiązanie\nUżyj dzielnika napięcia.\n:::" },
        { title: "Klucz – wartość (parametry)", src: ":::kv\nCPU | Xtensa LX6 · 240 MHz\nADC | 12-bit · 18 kanałów\nZasilanie | 3,3 V\n:::" },
        { title: "Statystyki (kafelki z liczbami)", src: ":::stats\nBaud | 115200 | bps | green\nBufor | 64 | B | orange\nBity | 10 | na bajt | accent\n:::\n\nKolumny: etykieta | wartość | jednostka | kolor (green, orange, accent)." },
        { title: "Plusy i minusy", src: ":::pros PLUSY\n- prosty\n- tani\n:::\n\n:::cons MINUSY\n- wolny\n:::" },
        { title: "Karta", src: ":::card Tytuł karty\nTreść karty w **markdownie**.\n:::" },
        { title: "Kod z kolorowaniem składni", src: "§§§cpp Miganie diodą\nvoid setup() { pinMode(2, OUTPUT); }\nvoid loop() { digitalWrite(2, !digitalRead(2)); delay(500); }\n§§§\n\nJęzyki: cpp, c, arduino, python, bash, yaml, json, ini, rust, js, html. Po nazwie języka można dać tytuł." }
      ] },

    { id: "obrazy", title: "4. Obrazy i grafiki", intro: F(
      ":::note Trzy rodzaje grafik\n" +
      "- **Obraz rastrowy** (zdjęcie, zrzut ekranu): sekcja **Obrazy** pod polem treści → wybierz plik → *Wgraj* → *Wstaw*. Dozwolone JPEG, PNG, WebP, GIF; serwer czyści metadane (np. GPS) i sam ustala typ pliku.\n" +
      "- **Rysunek wektorowy** (schemat, diagram): blok `:::figure Podpis` z kodem `<svg>`. Bez skryptów i zewnętrznych odwołań.\n" +
      "- **Animacja / interakcja**: widget (następna sekcja).\n" +
      ":::\n\n" +
      "Obraz wstawiony samotnie w osobnym akapicie wyświetla się jako **rysunek z podpisem** – podpisem jest tekst alternatywny: `![Podpis i opis](/static/media/…)`.\n\n" +
      ":::warn Zasady\n" +
      "- Wolno używać **tylko obrazów wgranych w panelu** (nie linków do cudzych stron – chroni to czytelników przed śledzeniem).\n" +
      "- Wgrywaj tylko **własne** zdjęcia i grafiki albo na wolnej licencji (podaj autora w podpisie). Nie kopiuj schematów z książek i kart katalogowych.\n" +
      "- Limity: do 30 obrazów na treść, kilka MB na plik (zależnie od konfiguracji serwera), limit wgrań na godzinę.\n" +
      "- Usunięcie obrazu w panelu kasuje plik – jeśli był wstawiony, w treści pojawi się komunikat zamiast obrazu.\n" +
      ":::\n\n" +
      "Poniżej przykład rysunku SVG – kod i wynik:\n"),
      examples: [{ title: "Rysunek SVG", src: ":::figure Dzielnik napięcia\n<svg viewBox=\"0 0 200 80\" xmlns=\"http://www.w3.org/2000/svg\">\n  <rect x=\"20\" y=\"25\" width=\"60\" height=\"30\" rx=\"4\" fill=\"none\" stroke=\"#56e1fd\" stroke-width=\"2\"/>\n  <text x=\"50\" y=\"45\" text-anchor=\"middle\" fill=\"#e6edf3\" font-size=\"14\">R1</text>\n  <path d=\"M80 40 H150\" stroke=\"#3fb950\" stroke-width=\"2\"/>\n</svg>\n:::" }] },

    { id: "widgety", title: "5. Widgety (własne animacje i kalkulatory)", intro: F(
      "Widget to mała, **samodzielna** strona HTML + CSS + JS wyświetlana w izolowanej ramce. Nie ma dostępu do sieci, do strony ani do Twoich danych (sandbox + polityka CSP) – dlatego bezpiecznie można w nim uruchamiać skrypty.\n\n" +
      "**Jak dodać:** sekcja *Widgety* → wybierz **szablon** i wpisz nazwę (a–z, 0–9, -, _) → *Dodaj widget*. Edytor sam wstawi blok `:::widget nazwa 320` (liczba = wysokość w px; widget i tak dopasuje się do zawartości w przedziale 80–1200).\n\n" +
      "**Reguły:** brak zewnętrznych zasobów (żadnych `<script src>`, CDN, obrazków z internetu – tylko `data:`), do 8 widgetów na treść, do 60 KB każdy i 200 KB łącznie. Używaj `textContent` zamiast `innerHTML` dla danych od użytkownika.\n\n" +
      "Szablony poniżej działają na żywo – wypróbuj je:\n"), templates: true,
      outro: F(
      "**Własny widget od Claude.** W osobnym czacie (z dołączonym projektem ESN-Platform) wklej opis, np.:\n\n" +
      "§§§text Prompt\nNapisz widget ESN do artykułu o PWM: jeden plik HTML z <style> i <script>, bez zewnętrznych zasobów i bez fetch/XHR.\nCiemny motyw (tło przezroczyste, tekst #e6edf3, akcent #56e1fd), czcionka systemowa, działa od 320 px szerokości.\nSuwak wypełnienia 0–100%, wykres przebiegu w SVG, wynik napięcia średniego. Teksty po polsku.\n§§§\n\n" +
      "Otrzymany kod wklej do widgetu w edytorze (pole kodu) i sprawdź w podglądzie na żywo.\n") },

    { id: "kursy", title: "6. Kursy i lekcje", md: F(
      "- Kurs zakłada **administrator** (zakładka *Kursy*: tytuł, opis, poziom).\n" +
      "- Lekcja to treść typu *Lekcja kursu* z wybranym kursem. Kolejność ustala pole **Pozycja** (mniejsza = wcześniej); przyciski „Poprzednia/Następna lekcja” powstają automatycznie.\n" +
      "- Kurs pokazuje się publicznie, gdy ma co najmniej jedną opublikowaną lekcję.\n" +
      "- Dobra lekcja: cel na początku (`:::summary`), jedna idea, przykład, mini-quiz lub zadanie na końcu.\n") },

    { id: "lista", title: "7. Lista kontrolna przed wysłaniem", md: F(
      ":::ok Sprawdź\n" +
      "- Tytuł jest konkretny, opis ma 1–2 zdania.\n" +
      "- Liczby, napięcia i parametry sprawdzone w dokumentacji producenta (nie z pamięci).\n" +
      "- Rysunki mają podpis; obrazy są własne lub na wolnej licencji.\n" +
      "- Każdy widget działa w podglądzie, także po zmianie wartości na skrajne.\n" +
      "- Sprawdzony wygląd na wąskim ekranie (telefon).\n" +
      "- Brak treści chronionych prawem autorskim.\n" +
      ":::\n") },

    { id: "admin", title: "8. Dla administratora", md: F(
      "- **Do zatwierdzenia**: lista treści oczekujących na decyzję. Otwórz, przejrzyj podgląd i widgety, potem **Zatwierdź** (publikuje) albo **Odrzuć** z powodem (redaktor widzi go w edytorze).\n" +
      "- **Zapisz i opublikuj**: publikacja własnej treści bez kolejki. **Wycofaj publikację**: ukrywa treść publicznie (zostaje szkicem).\n" +
      "- Redaktor może usuwać tylko własne, nieopublikowane treści; admin – każde.\n" +
      "- Historia zmian statusu jest w sekcji pod edytorem.\n" +
      "- Szczegóły techniczne i bezpieczeństwo: pliki `docs/WIEDZA.md` i `docs/BEZPIECZENSTWO.md` w repozytorium.\n") },

    { id: "faq", title: "9. Najczęstsze problemy", md: F(
      ":::kv\n" +
      "Blok się nie wyświetla | Brakuje zamykającego `:::` w osobnej linii albo blok jest w innym bloku (zagnieżdżanie nie działa)\n" +
      "„Brak widgetu” | Nazwa po `:::widget` różni się od nazwy w sekcji Widgety\n" +
      "Obraz zamiast zdjęcia pokazuje komunikat | Link nie prowadzi do pliku wgranego w panelu – wgraj obraz i użyj *Wstaw*\n" +
      "Nie mogę wgrać obrazu | Najpierw kliknij *Zapisz* (treść musi istnieć); sprawdź format i limit godzinowy\n" +
      "Nie mogę edytować | Treść jest *Do przeglądu* – poczekaj na decyzję administratora\n" +
      "Widget jest ucięty | Podaj większą wysokość w `:::widget nazwa 480`\n" +
      ":::\n") }
  ];

  global.ESNKnowledgeGuide = { sections: SECTIONS };
})(window);
