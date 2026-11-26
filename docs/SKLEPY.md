# „Gdzie kupić” – linki do sklepów przy komponentach (v48)

- Dane: `official_components.shops` (JSON) = lista `{name, url, region, note?}`; region: `""` (dowolny) / `pl` / `eu` / `world`.
  Migracja przy starcie (`ADD COLUMN IF NOT EXISTS shops JSON`).
- Walidacja na serwerze: `clean_shops` w `app/main.py` – tylko `http://` / `https://` bez spacji i znaków HTML (inaczej 400), maks. 12 linków,
  nazwa ≤ 60 znaków (brak = domena), uwaga ≤ 120, duplikaty adresów odrzucane, nieznane pola (np. cena) pomijane. **Bez cen** – szybko się dezaktualizują.
- Edycja: formularz komponentu w katalogu (ci sami, którzy edytują katalog: admin / moderator), sekcja „Gdzie kupić” (wiersze: nazwa, adres, region, uwaga).
  Zły adres jest podświetlany i blokuje zapis.
- Wyświetlanie: karta komponentu (sekcja „Gdzie kupić” nad pinoutem), znaczek 🛒 n na miniaturce w katalogu,
  magazyn – szczegóły komponentu dodanego z katalogu (`catalog_item_id`) pobierają linki z `GET /api/catalog/{id}`.
  Linki: `target=_blank`, `rel="noopener noreferrer nofollow"`, widoczna domena, zastrzeżenie o zewnętrznych sklepach.
- Kod: `app/static/shops.js` + `shops.css` (identyczne kopie w `app/esn_magazyn/static/`, pilnuje test), testy `tests/test_shops.py`.
- Pomysły na później: lista zakupowa ze schematu (BOM → sklepy, z pominięciem części z magazynu), linki partnerskie (wymagają oznaczenia), sugestie linków od użytkowników z moderacją.
