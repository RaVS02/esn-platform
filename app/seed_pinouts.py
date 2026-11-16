"""Wczytuje opisy podzespołów z app/pinouts/*.json do katalogu (OfficialComponent).

Każdy plik: {name, symbol, inventory_category, applications, tags, technical_specs,
             description, datasheet_url, pinout:{...}}
Istniejący komponent (po nazwie): jeśli ma już pinout – pomijany (chyba że --force); brakujące pola uzupełniane.
Uruchomienie:  docker compose exec web python seed_pinouts.py [--force]
"""
import glob, json, os, sys
from sqlalchemy import text
import models
from database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)
with engine.begin() as c:
    c.execute(text("ALTER TABLE official_components ADD COLUMN IF NOT EXISTS pinout JSON"))

FORCE = "--force" in sys.argv
db = SessionLocal()
for path in sorted(glob.glob(os.path.join(os.path.dirname(__file__), "pinouts", "*.json"))):
    d = json.load(open(path, encoding="utf-8"))
    item = db.query(models.OfficialComponent).filter(models.OfficialComponent.name == d["name"]).first()
    if item is None:
        item = models.OfficialComponent(name=d["name"])
        db.add(item)
        action = "dodano"
    elif item.pinout and not FORCE:
        print(f"-> {d['name']}: ma już pinout – pominięto (użyj --force, by nadpisać)")
        continue
    else:
        action = "zaktualizowano pinout"
    item.pinout = d["pinout"]
    for f in ("symbol", "inventory_category", "applications", "tags", "technical_specs", "description", "datasheet_url"):
        if f in d and not getattr(item, f):
            setattr(item, f, d[f])
    print(f"-> {d['name']}: {action} ({len(d['pinout']['pins'])} pinów)")
db.commit()
