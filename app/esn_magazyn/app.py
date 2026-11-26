from flask import Flask, render_template, request, jsonify, redirect, g, session
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean, func
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from datetime import datetime
import time
import os
import json
import requests
import jwt  # pip install pyjwt
from flasgger import Swagger  # Import biblioteki Flasgger

app = Flask(__name__)

class ScriptNameFix:
    def __init__(self, wsgi_app, prefix):
        self.wsgi_app = wsgi_app
        self.prefix = prefix

    def __call__(self, environ, start_response):
        environ['SCRIPT_NAME'] = self.prefix
        return self.wsgi_app(environ, start_response)

app.wsgi_app = ScriptNameFix(app.wsgi_app, '/magazyn')

# Upewnij się że folder na bazy istnieje (ważne przy named volume przy pierwszym starcie)
INSTANCE_DIR = '/app/esn_magazyn/instance'
os.makedirs(INSTANCE_DIR, exist_ok=True)

# ─── KONFIGURACJA ─────────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'brak_klucza_w_env_file!')
if SECRET_KEY == 'brak_klucza_w_env_file!':
    print("OSTRZEŻENIE: brak JWT_SECRET_KEY w .env – używany jest klucz domyślny (każdy może podrobić token). Ustaw losowy klucz.")
app.secret_key = SECRET_KEY
ALGORITHM  = "HS256"

# URL portalu – do przekierowań przy braku sesji
PORTAL_URL = os.environ.get('PORTAL_URL', 'http://localhost')

# Szablon, który mówi Swaggerowi, pod jakim adresem naprawdę żyje aplikacja
swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "ESN Magazyn API",
        "description": "Dokumentacja i testowanie endpointów",
        "version": "1.0",
    },
    "basePath": "/magazyn" # Dzięki temu Swagger UI poprawnie doklei ścieżkę podczas testowania API
}

# Zaktualizowana konfiguracja wymuszająca zewnętrzne biblioteki (CDN)
swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": 'apispec_1',
            "route": '/apispec_1.json',
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/docs",
    # Poniższe linki zmuszają do pobrania UI bezpośrednio z sieci (omijamy 404 na serwerze)
    "swagger_ui_bundle_js": "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js",
    "swagger_ui_standalone_preset_js": "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js",
    "jquery_js": "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js",
    "swagger_ui_css": "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css"
}

swagger = Swagger(app, config=swagger_config, template=swagger_template)

# ─── MODELS ───────────────────────────────────────────────────────────────────
Base = declarative_base()


class Category(Base):
    __tablename__ = 'category'
    id         = Column(Integer, primary_key=True)
    name       = Column(String(100), nullable=False, unique=True)
    icon       = Column(String(50), default='🔧')
    color      = Column(String(20), default='#56e1fd')
    is_custom  = Column(Boolean, default=True)
    components = relationship('Component', backref='category', lazy=True)

    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'icon': self.icon,
                'color': self.color, 'is_custom': self.is_custom}


class Component(Base):
    __tablename__ = 'component'
    id                 = Column(Integer, primary_key=True)
    name               = Column(String(200), nullable=False)
    symbol             = Column(String(100))
    description        = Column(Text)
    category_id        = Column(Integer, ForeignKey('category.id'), nullable=False)
    quantity_total     = Column(Integer, default=0)
    quantity_available = Column(Integer, default=0)
    unit               = Column(String(20), default='szt.')
    location           = Column(String(200))
    datasheet_url      = Column(String(500))
    tags               = Column(Text, default='[]')
    applications       = Column(Text, default='[]')
    notes              = Column(Text)
    specs              = Column(Text)
    min_stock          = Column(Integer, default=0)
    catalog_item_id    = Column(Integer, nullable=True)
    created_at         = Column(DateTime, default=datetime.utcnow)
    updated_at         = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project_components = relationship('ProjectComponent', backref='component',
                                      lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        cat = self.category
        return {
            'id': self.id, 'name': self.name, 'symbol': self.symbol,
            'description': self.description,
            'category_id': self.category_id,
            'category': cat.name if cat else None,
            'category_icon': cat.icon if cat else '🔧',
            'category_color': cat.color if cat else '#56e1fd',
            'quantity_total': self.quantity_total,
            'quantity_available': self.quantity_available,
            'quantity_used': self.quantity_total - self.quantity_available,
            'unit': self.unit, 'location': self.location,
            'datasheet_url': self.datasheet_url,
            'tags': json.loads(self.tags) if self.tags else [],
            'applications': json.loads(self.applications) if self.applications else [],
            'notes': self.notes, 'specs': self.specs, 'min_stock': self.min_stock,
            'catalog_item_id': self.catalog_item_id,
            'low_stock': self.quantity_available <= self.min_stock,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Project(Base):
    __tablename__ = 'project'
    id                 = Column(Integer, primary_key=True)
    name               = Column(String(200), nullable=False)
    description        = Column(Text)
    status             = Column(String(50), default='planning')
    color              = Column(String(20), default='#56e1fd')
    created_at         = Column(DateTime, default=datetime.utcnow)
    project_components = relationship('ProjectComponent', backref='project',
                                      lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'description': self.description,
            'status': self.status, 'color': self.color,
            'components_count': len(self.project_components),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class ProjectComponent(Base):
    __tablename__ = 'project_component'
    id            = Column(Integer, primary_key=True)
    project_id    = Column(Integer, ForeignKey('project.id'), nullable=False)
    component_id  = Column(Integer, ForeignKey('component.id'), nullable=False)
    quantity_used = Column(Integer, default=1)
    status        = Column(String(50), default='active')
    notes         = Column(Text)
    added_at      = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        comp = self.component
        cat  = comp.category if comp else None
        proj = self.project
        
        return {
            'id': self.id, 
            'project_id': self.project_id,
            'project_name': proj.name if proj else None,
            'component_id': self.component_id,
            'component_name': comp.name if comp else None,
            'component_symbol': comp.symbol if comp else None,
            'category_icon': cat.icon if cat else '🔧',
            'quantity_used': self.quantity_used,
            'component_available': comp.quantity_available if comp else 0,
            'status': self.status, 
            'notes': self.notes,
        }


# Ikony „sch:<klucz>” = wspólny zestaw ikon (static/esn-icons.js, te same rysunki co w edytorze schematów) – v44.
DEFAULT_CATEGORIES = [
    ('Czujniki', 'sch:sensor', '#f97316'),
    ('Diody', 'sch:diode', '#ef4444'),
    ('Kondensatory', 'sch:cap', '#3b82f6'),
    ('Mikrokontrolery', 'sch:mcu', '#10b981'),
    ('Moduły', 'sch:module', '#6366f1'),
    ('Rezystory', 'sch:res', '#f59e0b'),
    ('Tranzystory', 'sch:trans', '#8b5cf6'),
    ('Układy scalone', 'sch:ic', '#06b6d4'),
    ('Wyświetlacze', 'sch:display', '#ec4899'),
    ('Zasilacze', 'sch:power', '#fbbf24'),
    ('Złącza', 'sch:conn', '#84cc16'),
    ('Inne', 'sch:box', '#64748b'),
]
# dawne ikony domyślne (Font Awesome) – podmieniane na nowe tylko wtedy, gdy użytkownik ich nie zmieniał
OLD_DEFAULT_ICONS = {
    'Czujniki': 'fa-solid fa-satellite-dish', 'Diody': 'fa-solid fa-caret-right', 'Kondensatory': 'fa-solid fa-battery-half',
    'Mikrokontrolery': 'fa-solid fa-server', 'Moduły': 'fa-solid fa-layer-group', 'Rezystory': 'fa-solid fa-wave-square',
    'Tranzystory': 'fa-solid fa-code-branch', 'Układy scalone': 'fa-solid fa-microchip', 'Wyświetlacze': 'fa-solid fa-desktop',
    'Zasilacze': 'fa-solid fa-bolt', 'Złącza': 'fa-solid fa-plug', 'Inne': 'fa-solid fa-wrench',
}


def migrate_default_icons(session):
    """v44: domyślne kategorie z niezmienioną ikoną Font Awesome → ikona ze wspólnego zestawu (sch:…). Własne ikony zostają."""
    new = {name: icon for name, icon, _ in DEFAULT_CATEGORIES}
    changed = False
    for cat in session.query(Category).filter(Category.name.in_(list(OLD_DEFAULT_ICONS))).all():
        if cat.icon == OLD_DEFAULT_ICONS.get(cat.name):
            cat.icon = new[cat.name]
            changed = True
    if changed:
        session.commit()

def seed_if_empty(session):
    if session.query(Category).count() == 0:
        for name, icon, color in DEFAULT_CATEGORIES:
            session.add(Category(name=name, icon=icon, color=color, is_custom=False))
        session.commit()
    else:
        migrate_default_icons(session)


# ─── SESSION (multi-tenant – jedna DB na usera) ───────────────────────────────
@app.before_request
def load_user_db():
    if request.endpoint == 'static' or (request.endpoint and request.endpoint.startswith('flasgger')):
        return

    token = request.cookies.get('esn_access_token')
    if not token:
        dev_db = f'{INSTANCE_DIR}/dev.db'
        if os.environ.get('FLASK_ENV') == 'development' and not os.path.exists(dev_db):
            _init_db(dev_db)
        if os.environ.get('FLASK_ENV') == 'development':
            engine = create_engine(f'sqlite:///{dev_db}')
            Session = sessionmaker(bind=engine)
            g.db_session = Session()
            seed_if_empty(g.db_session)
            return
        return redirect(PORTAL_URL)

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get('user_id')
        session['user_id'] = payload.get('sub')
        session['user_name'] = payload.get('username')
        db_path = f'{INSTANCE_DIR}/user_{user_id}.db'

        if not os.path.exists(db_path):
            os.makedirs(os.path.dirname(db_path), exist_ok=True)
            open(db_path, 'w').close()

        engine = create_engine(f'sqlite:///{db_path}')
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        g.db_session = Session()
        seed_if_empty(g.db_session)

    except Exception as e:
        print(f'BLAD AUTORYZACJI MAGAZYNU: {e}')
        return redirect(PORTAL_URL)


def _init_db(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    engine = create_engine(f'sqlite:///{path}')
    Base.metadata.create_all(engine)


@app.teardown_request
def close_db(exception=None):
    db = g.pop('db_session', None)
    if db:
        db.close()


# ─── ROUTES ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    """
    Strona glowna aplikacji
    ---
    tags:
      - Widoki
    responses:
      200:
        description: Renderowanie glównego szablonu HTML
    """
    return render_template('index.html')


# ── Categories ──────────────────────────────────────────────────────────────

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """
    Pobieranie listy kategorii
    ---
    tags:
      - Kategorie
    responses:
      200:
        description: Lista wszystkich dostepnych kategorii
    """
    cats = g.db_session.query(Category).all()
    return jsonify([c.to_dict() for c in cats])


@app.route('/api/categories', methods=['POST'])
def create_category():
    """
    Tworzenie nowej kategorii
    ---
    tags:
      - Kategorie
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - name
          properties:
            name:
              type: string
            icon:
              type: string
            color:
              type: string
    responses:
      201:
        description: Utworzono nowa kategorie
    """
    d = request.json
    cat = Category(name=d['name'], icon=d.get('icon', '🔧'),
                   color=d.get('color', '#56e1fd'), is_custom=True)
    g.db_session.add(cat)
    g.db_session.commit()
    return jsonify(cat.to_dict()), 201


@app.route('/api/categories/<int:cat_id>', methods=['PUT'])
def update_category(cat_id):
    """
    Aktualizacja istniejącej kategorii
    ---
    tags:
      - Kategorie
    parameters:
      - name: cat_id
        in: path
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            name:
              type: string
            icon:
              type: string
            color:
              type: string
    responses:
      200:
        description: Zaktualizowana kategoria
      404:
        description: Nie znaleziono kategorii
    """
    cat = g.db_session.get(Category, cat_id)
    if not cat:
        return jsonify({'error': 'Nie znaleziono kategorii'}), 404
        
    d = request.json
    if 'name' in d: cat.name = d['name']
    if 'icon' in d: cat.icon = d['icon']
    if 'color' in d: cat.color = d['color']
    
    g.db_session.commit()
    return jsonify(cat.to_dict())


@app.route('/api/categories/<int:cat_id>', methods=['DELETE'])
def delete_category(cat_id):
    """
    Usuwanie kategorii pod warunkiem, ze jest pusta
    ---
    tags:
      - Kategorie
    parameters:
      - name: cat_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Status powodzenia operacji
      400:
        description: Blad walidacji (kategoria zawiera komponenty)
      404:
        description: Nie znaleziono kategorii
    """
    cat = g.db_session.get(Category, cat_id)
    if not cat:
        return jsonify({'error': 'Nie znaleziono kategorii'}), 404
    
    if len(cat.components) > 0:
        return jsonify({'error': 'Nie można usunąć. Najpierw przenieś lub usuń komponenty z tej kategorii!'}), 400
        
    g.db_session.delete(cat)
    g.db_session.commit()
    return jsonify({'ok': True})


# ── Components ───────────────────────────────────────────────────────────────

@app.route('/api/components', methods=['GET'])
def get_components():
    """
    Pobieranie listy komponentów z filtrowaniem
    ---
    tags:
      - Komponenty
    parameters:
      - name: q
        in: query
        type: string
        description: Szukana fraza w nazwie, symbolu lub tagach
      - name: category
        in: query
        type: integer
        description: ID filtrowanej kategorii
      - name: low_stock
        in: query
        type: string
        description: Wprowadz '1' aby wyszukac komponenty o niskim stanie
    responses:
      200:
        description: Lista komponentów spełniających kryteria
    """
    q        = request.args.get('q', '')
    cat_id   = request.args.get('category')
    low_stock = request.args.get('low_stock')

    query = g.db_session.query(Component)
    if q:
        query = query.filter(
            (Component.name.ilike(f'%{q}%')) |
            (Component.symbol.ilike(f'%{q}%')) |
            (Component.tags.ilike(f'%{q}%'))
        )
    if cat_id:
        query = query.filter_by(category_id=int(cat_id))

    comps = [c.to_dict() for c in query.all()]
    if low_stock == '1':
        comps = [c for c in comps if c['low_stock']]
    return jsonify(comps)


@app.route('/api/components', methods=['POST'])
def create_component():
    """
    Dodawanie nowego komponentu do magazynu
    ---
    tags:
      - Komponenty
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - name
            - category_id
          properties:
            name:
              type: string
            symbol:
              type: string
            description:
              type: string
            category_id:
              type: integer
            quantity_total:
              type: integer
            quantity_available:
              type: integer
            unit:
              type: string
            location:
              type: string
            datasheet_url:
              type: string
            tags:
              type: array
              items:
                type: string
            applications:
              type: array
              items:
                type: string
            notes:
              type: string
            specs:
              type: string
            min_stock:
              type: integer
            catalog_item_id:
              type: integer
    responses:
      201:
        description: Komponent zostal utworzony
    """
    d = request.json
    if not d.get('name') or not isinstance(d.get('category_id'), int):
        return jsonify({'error': 'Wybierz kategorię komponentu'}), 400
    comp = Component(
        name=d['name'],
        symbol=d.get('symbol'),
        description=d.get('description'),
        category_id=d['category_id'],
        quantity_total=int(d.get('quantity_total', 0)),
        quantity_available=int(d.get('quantity_available', d.get('quantity_total', 0))),
        unit=d.get('unit', 'szt.'),
        location=d.get('location'),
        datasheet_url=d.get('datasheet_url'),
        tags=json.dumps(d.get('tags', [])),
        applications=json.dumps(d.get('applications', [])),
        notes=d.get('notes'),
        specs=d.get('specs'),
        min_stock=int(d.get('min_stock', 0)),
        catalog_item_id=d.get('catalog_item_id'),
    )
    g.db_session.add(comp)
    g.db_session.commit()
    return jsonify(comp.to_dict()), 201


@app.route('/api/components/<int:comp_id>', methods=['GET'])
def get_component(comp_id):
    """
    Pobieranie szczegółów wybranego komponentu wraz z przypisanymi projektami
    ---
    tags:
      - Komponenty
    parameters:
      - name: comp_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Szczególy komponentu
      404:
        description: Nie znaleziono komponentu
    """
    comp = g.db_session.get(Component, comp_id)
    if not comp:
        return jsonify({'error': 'Not found'}), 404
    data = comp.to_dict()
    data['projects'] = [pc.to_dict() for pc in comp.project_components]
    return jsonify(data)


@app.route('/api/components/<int:comp_id>', methods=['PUT'])
def update_component(comp_id):
    """
    Aktualizacja danych komponentu
    ---
    tags:
      - Komponenty
    parameters:
      - name: comp_id
        in: path
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            name:
              type: string
            symbol:
              type: string
            description:
              type: string
            category_id:
              type: integer
            quantity_total:
              type: integer
            quantity_available:
              type: integer
            unit:
              type: string
            location:
              type: string
            datasheet_url:
              type: string
            notes:
              type: string
            specs:
              type: string
            min_stock:
              type: integer
            catalog_item_id:
              type: integer
            tags:
              type: array
              items:
                type: string
            applications:
              type: array
              items:
                type: string
    responses:
      200:
        description: Dane komponentu zostały zaktualizowane
      404:
        description: Nie znaleziono komponentu
    """
    comp = g.db_session.get(Component, comp_id)
    if not comp:
        return jsonify({'error': 'Not found'}), 404
    d = request.json
    for field in ['name', 'symbol', 'description', 'category_id', 'quantity_total',
                  'quantity_available', 'unit', 'location', 'datasheet_url', 'notes',
                  'specs', 'min_stock', 'catalog_item_id']:
        if field in d:
            setattr(comp, field, d[field])
    if 'tags' in d:
        comp.tags = json.dumps(d['tags'])
    if 'applications' in d:
        comp.applications = json.dumps(d['applications'])
    comp.updated_at = datetime.utcnow()
    g.db_session.commit()
    return jsonify(comp.to_dict())


@app.route('/api/components/<int:comp_id>', methods=['DELETE'])
def delete_component(comp_id):
    """
    Usuwanie komponentu z magazynu
    ---
    tags:
      - Komponenty
    parameters:
      - name: comp_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Komponent pomyślnie usunięty
      404:
        description: Nie znaleziono komponentu
    """
    comp = g.db_session.get(Component, comp_id)
    if not comp:
        return jsonify({'error': 'Not found'}), 404
    g.db_session.delete(comp)
    g.db_session.commit()
    return jsonify({'ok': True})


@app.route('/api/components/<int:comp_id>/adjust', methods=['POST'])
def adjust_stock(comp_id):
    """
    Szybka korekta lub ręczne ustawienie ilości komponentu
    ---
    tags:
      - Komponenty
    parameters:
      - name: comp_id
        in: path
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            set_available:
              type: integer
              description: Bezpośrednie ustawienie wolnej liczby sztuk
            delta:
              type: integer
              description: Wartość zmiany względnej (np. +1, -5)
    responses:
      200:
        description: Zaktualizowany stan komponentu
      400:
        description: Blad walidacji danych wejściowych lub brak wystarczającej ilości
      404:
        description: Nie znaleziono komponentu
    """
    comp = g.db_session.get(Component, comp_id)
    if not comp:
        return jsonify({'error': 'Not found'}), 404
        
    d = request.json
    
    if 'set_available' in d:
        new_avail = int(d['set_available'])
        if new_avail < 0:
            return jsonify({'error': 'Ilość nie może być ujemna'}), 400
        
        diff = new_avail - comp.quantity_available
        comp.quantity_available = new_avail
        comp.quantity_total += diff
        
    elif 'delta' in d:
        delta = int(d.get('delta', 0))
        
        if comp.quantity_available + delta < 0:
            return jsonify({'error': 'Brak wystarczającej ilości wolnych komponentów do usunięcia'}), 400
            
        comp.quantity_available += delta
        comp.quantity_total += delta

    comp.updated_at = datetime.utcnow()
    g.db_session.commit()
    return jsonify(comp.to_dict())


# ── Projects ─────────────────────────────────────────────────────────────────

@app.route('/api/projects', methods=['GET'])
def get_projects():
    """
    Pobieranie wszystkich projektów
    ---
    tags:
      - Projekty
    responses:
      200:
        description: Lista projektów
    """
    projs = g.db_session.query(Project).all()
    return jsonify([p.to_dict() for p in projs])


@app.route('/api/projects', methods=['POST'])
def create_project():
    """
    Utworzenie nowego projektu
    ---
    tags:
      - Projekty
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - name
          properties:
            name:
              type: string
            description:
              type: string
            status:
              type: string
            color:
              type: string
    responses:
      201:
        description: Utworzono projekt
    """
    d = request.json
    proj = Project(
        name=d['name'], description=d.get('description'),
        status=d.get('status', 'planning'), color=d.get('color', '#56e1fd'),
    )
    g.db_session.add(proj)
    g.db_session.commit()
    return jsonify(proj.to_dict()), 201


@app.route('/api/projects/<int:proj_id>', methods=['GET'])
def get_project(proj_id):
    """
    Pobieranie szczegółów projektu wraz z listą powiązanych komponentów
    ---
    tags:
      - Projekty
    parameters:
      - name: proj_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Szczegóły projektu
      404:
        description: Nie znaleziono projektu
    """
    proj = g.db_session.get(Project, proj_id)
    if not proj:
        return jsonify({'error': 'Not found'}), 404
    data = proj.to_dict()
    data['components'] = [pc.to_dict() for pc in proj.project_components]
    return jsonify(data)


@app.route('/api/projects/<int:proj_id>', methods=['PUT'])
def update_project(proj_id):
    """
    Aktualizacja metadanych projektu
    ---
    tags:
      - Projekty
    parameters:
      - name: proj_id
        in: path
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            name:
              type: string
            description:
              type: string
            status:
              type: string
            color:
              type: string
    responses:
      200:
        description: Dane projektu zostały zaktualizowane
      404:
        description: Nie znaleziono projektu
    """
    proj = g.db_session.get(Project, proj_id)
    if not proj:
        return jsonify({'error': 'Not found'}), 404
    d = request.json
    for field in ['name', 'description', 'status', 'color']:
        if field in d:
            setattr(proj, field, d[field])
    g.db_session.commit()
    return jsonify(proj.to_dict())


@app.route('/api/projects/<int:proj_id>', methods=['DELETE'])
def delete_project(proj_id):
    """
    Usunięcie projektu
    ---
    tags:
      - Projekty
    parameters:
      - name: proj_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Projekt pomyślnie usunięty
      404:
        description: Nie znaleziono projektu
    """
    proj = g.db_session.get(Project, proj_id)
    if not proj:
        return jsonify({'error': 'Not found'}), 404
    g.db_session.delete(proj)
    g.db_session.commit()
    return jsonify({'ok': True})


@app.route('/api/projects/<int:proj_id>/components', methods=['POST'])
def add_to_project(proj_id):
    """
    Przypisanie komponentu do projektu (pobranie z magazynu)
    ---
    tags:
      - Projekty
    parameters:
      - name: proj_id
        in: path
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - component_id
          properties:
            component_id:
              type: integer
            quantity:
              type: integer
            notes:
              type: string
    responses:
      201:
        description: Komponent pomyślnie powiązany z projektem
      400:
        description: Niewystarczająca ilość wolnych zasobów w magazynie
      404:
        description: Nie znaleziono projektu lub komponentu
    """
    proj = g.db_session.get(Project, proj_id)
    if not proj:
        return jsonify({'error': 'Not found'}), 404
        
    d    = request.json
    comp = g.db_session.get(Component, d['component_id'])
    if not comp:
        return jsonify({'error': 'Component not found'}), 404
        
    qty = int(d.get('quantity', 1))
    if comp.quantity_available < qty:
        return jsonify({'error': f'Niewystarczająca ilość. Dostępne: {comp.quantity_available}'}), 400
        
    existing_pc = g.db_session.query(ProjectComponent).filter_by(
        project_id=proj_id, component_id=comp.id, status='active'
    ).first()

    if existing_pc:
        existing_pc.quantity_used += qty
        new_notes = d.get('notes')
        if new_notes:
            if existing_pc.notes:
                existing_pc.notes += f" | {new_notes}"
            else:
                existing_pc.notes = new_notes
        pc = existing_pc
    else:
        pc = ProjectComponent(
            project_id=proj_id, component_id=comp.id,
            quantity_used=qty, status='active', notes=d.get('notes'),
        )
        g.db_session.add(pc)

    comp.quantity_available -= qty
    g.db_session.commit()
    
    return jsonify(pc.to_dict()), 201


@app.route('/api/projects/<int:proj_id>/components/<int:pc_id>', methods=['PUT'])
def update_project_component(proj_id, pc_id):
    """
    Aktualizacja statusu lub liczby sztuk komponentu wewnątrz projektu
    ---
    tags:
      - Projekty
    parameters:
      - name: proj_id
        in: path
        type: integer
        required: true
      - name: pc_id
        in: path
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            status:
              type: string
              description: Nowy status (np. active, returned, broken)
            quantity:
              type: integer
              description: Nowa skorygowana liczba użytych sztuk
            notes:
              type: string
    responses:
      200:
        description: Zaktualizowano powiązanie komponentu
      400:
        description: Brak wymaganej liczby sztuk w głównym magazynie przy zwiększaniu alokacji
      404:
        description: Nie znaleziono rekordu
    """
    pc = g.db_session.get(ProjectComponent, pc_id)
    if not pc:
        return jsonify({'error': 'Not found'}), 404
        
    d = request.json
    old_status = pc.status
    new_status = d.get('status', pc.status)
    
    if new_status != old_status:
        pc.status = new_status
        if old_status == 'active':
            if new_status == 'returned':
                pc.component.quantity_available += pc.quantity_used
            elif new_status == 'broken':
                pc.component.quantity_total = max(0, pc.component.quantity_total - pc.quantity_used)
                
    if 'quantity' in d and pc.status == 'active':
        new_qty = int(d['quantity'])
        diff = new_qty - pc.quantity_used
        
        if diff > 0:
            if pc.component.quantity_available < diff:
                return jsonify({'error': f'Brak wystarczającej ilości w magazynie. Wolne sztuki: {pc.component.quantity_available}'}), 400
            pc.component.quantity_available -= diff
            
        elif diff < 0:
            pc.component.quantity_available += abs(diff)
            
        pc.quantity_used = new_qty

    if 'notes' in d:
        pc.notes = d['notes']
        
    g.db_session.commit()
    return jsonify(pc.to_dict())


@app.route('/api/projects/<int:proj_id>/components/<int:pc_id>', methods=['DELETE'])
def remove_from_project(proj_id, pc_id):
    """
    Usunięcie komponentu z projektu i zwrot aktywnych sztuk do wolnego magazynu
    ---
    tags:
      - Projekty
    parameters:
      - name: proj_id
        in: path
        type: integer
        required: true
      - name: pc_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Powiązanie usunięte pomyślnie
      404:
        description: Nie znaleziono rekordu
    """
    pc = g.db_session.get(ProjectComponent, pc_id)
    if not pc:
        return jsonify({'error': 'Not found'}), 404
    if pc.status == 'active':
        pc.component.quantity_available += pc.quantity_used
    g.db_session.delete(pc)
    g.db_session.commit()
    return jsonify({'ok': True})


# ── Stats ─────────────────────────────────────────────────────────────────────

@app.route('/api/stats')
def get_stats():
    """
    Globalne statystyki bazy danych magazynu użytkownika
    ---
    tags:
      - Statystyki
    responses:
      200:
        description: Podsumowanie stanów, niskich magazynów oraz liczby projektów
    """
    all_c = g.db_session.query(Component).all()
    return jsonify({
        'total_components': len(all_c),
        'total_quantity': sum(c.quantity_total for c in all_c),
        'low_stock': sum(1 for c in all_c if c.quantity_available <= c.min_stock),
        'active_projects': g.db_session.query(Project).filter_by(status='active').count(),
        'categories': g.db_session.query(Category).count(),
    })


# ── AI ────────────────────────────────────────────────────────────────────────

def _build_context():
    comps = g.db_session.query(Component).all()
    projs = g.db_session.query(Project).all()
    
    if not comps and not projs:
        return "Magazyn sprzętowy i lista projektów są obecnie puste."
        
    lines = []
    
    if comps:
        lines.append("=== STAN MAGAZYNU ===")
        for c in comps:
            try:
                apps_list = json.loads(c.applications) if c.applications else []
                apps_str = ", ".join(apps_list) if apps_list else "Brak"
            except:
                apps_str = "Brak"
                
            try:
                tags_list = json.loads(c.tags) if c.tags else []
                tags_str = ", ".join(tags_list) if tags_list else "Brak tagów"
            except:
                tags_str = "Brak"
                
            line = f"• {c.name} "
            if c.symbol:
                line += f"({c.symbol}) "
            
            cat_name = c.category.name if c.category else "Brak"
            line += f"- Kat: {cat_name}. Zastosowanie: {apps_str}. Tagi: {tags_str}. "
            if c.catalog_item_id:
                line += f"KARTA: [{c.name}](/#components/{int(c.catalog_item_id)}). "
            line += f"STAN: {c.quantity_available}/{c.quantity_total} {c.unit}. "
            
            if c.quantity_available <= c.min_stock:
                line += "UWAGA: NISKI STAN. "
            
            if c.location:
                line += f"Lokalizacja: {c.location}. "
                
            if c.description:
                line += f"Opis: {c.description}. "
                
            if c.specs:
                clean_specs = c.specs.replace('\\n', ' | ').replace('\n', ' | ')
                line += f"Specyfikacja: {clean_specs}. "
                
            lines.append(line)
            
    if projs:
        lines.append("\n=== AKTYWNE PROJEKTY ===")
        for p in projs:
            desc = f": {p.description}" if p.description else ""
            lines.append(f"• {p.name} [Status: {p.status}]{desc}")
            
    return "\n".join(lines)

SYSTEM_PROMPT = """Jesteś ESN AI – asystentem dla elektronika/hobbyisty.
Znasz aktualny stan magazynu użytkownika. Odpowiadaj po polsku, technicznie precyzyjnie,nie twórz fałszywych informacji oraz pisz jasno i zwięźle,krótko.
Twoje zadania:
- Doradzaj co można zbudować z dostępnych komponentów
- Ostrzegaj o niskich stanach i pułapkach komponentów
- Sugeruj projekty edukacyjne i praktyczne
- Pomagaj w doborze i sprawdzaj dostępność komponentów
Gdy wspominasz komponent, przy którym w danych jest pole KARTA, podaj ten link dokładnie w formacie z danych, np. [Nazwa](/#components/12). Nie wymyślaj własnych linków.
{inventory}
Bądź konkretny i praktyczny."""


# ─── AI: bramka w portalu (limity, własny klucz, dostawcy) ────────────────────────────────────────
# Magazyn buduje tylko kontekst (stan magazynu); wybór klucza, limit dzienny i wywołanie dostawcy robi portal.
# Model lokalny (Ollama/LM Studio) wywołuje przeglądarka bezpośrednio – magazyn daje jej tylko kontekst (/api/ai/context).
PORTAL_INTERNAL_URL = os.environ.get('PORTAL_INTERNAL_URL', 'http://web:8000').rstrip('/')


def _portal(path, method='GET', payload=None):
    token = request.cookies.get('esn_access_token')
    return requests.request(method, PORTAL_INTERNAL_URL + path, json=payload, timeout=(3, 70),
                            headers={'Authorization': 'Bearer ' + (token or '')})


def _portal_error(r):
    try:
        msg = r.json().get('detail') or r.text[:200]
    except ValueError:
        msg = r.text[:200]
    if r.status_code in (401, 403):
        msg = 'Sesja wygasła lub konto jest zablokowane – zaloguj się ponownie w portalu.'
    return jsonify({'error': msg if isinstance(msg, str) else 'Błąd asystenta AI'}), (r.status_code if r.status_code < 600 else 500)


@app.route('/api/ai/context')
def ai_context():
    """
    Kontekst systemowy z aktualnym stanem magazynu (dla modelu lokalnego wywoływanego z przeglądarki)
    ---
    tags:
      - Sztuczna Inteligencja
    responses:
      200:
        description: Gotowy prompt systemowy
    """
    return jsonify({'system': SYSTEM_PROMPT.format(inventory=_build_context())})


@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    """
    Wysyłanie zapytania do asystenta AI powiązanego z kontekstem zasobów magazynowych
    ---
    tags:
      - Sztuczna Inteligencja
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - message
          properties:
            message:
              type: string
              description: Wiadomość użytkownika do przetworzenia
            history:
              type: array
              description: Tablica z dotychczasową historią rozmowy
              items:
                type: object
                properties:
                  role:
                    type: string
                  content:
                    type: string
    responses:
      200:
        description: Odpowiedź asystenta oraz stan limitu
      429:
        description: Dzienny limit zapytań wyczerpany albo zbyt częste zapytania
      503:
        description: Asystent nie jest skonfigurowany na serwerze
    """
    d = request.get_json(silent=True) or {}
    user_msg = str(d.get('message', ''))[:1000].strip()
    if not user_msg:
        return jsonify({'error': 'Pusta wiadomość.'}), 400
    history = []
    for msg in (d.get('history') or [])[-10:]:
        if isinstance(msg, dict):
            history.append({'role': msg.get('role'), 'content': str(msg.get('content', ''))[:1000]})
    # przeglądarka dołącza bieżące pytanie także do historii – nie wysyłamy go dwa razy
    if history and history[-1]['role'] == 'user' and history[-1]['content'].strip() == user_msg:
        history.pop()
    history.append({'role': 'user', 'content': user_msg})
    try:
        r = _portal('/api/ai/complete', 'POST', {'system': SYSTEM_PROMPT.format(inventory=_build_context()), 'messages': history})
    except requests.exceptions.RequestException:
        return jsonify({'error': 'Brak połączenia z serwerem portalu. Spróbuj za chwilę.'}), 502
    if r.status_code != 200:
        return _portal_error(r)
    return jsonify(r.json())


@app.route('/api/ai/provider')
def ai_provider():
    """
    Stan asystenta AI dla zalogowanego użytkownika (limit, własny klucz)
    ---
    tags:
      - Sztuczna Inteligencja
    responses:
      200:
        description: Nazwa dostawcy, limit i liczba pozostałych zapytań
    """
    try:
        r = _portal('/api/ai/status')
    except requests.exceptions.RequestException:
        return jsonify({'configured': False, 'name': 'Portal niedostępny', 'own_key': False})
    if r.status_code != 200:
        return _portal_error(r)
    j = r.json()
    own = j.get('own_key')
    name = ((j.get('providers') or {}).get(j.get('own_provider')) or {}).get('name', '') if own else j.get('system_name', 'Asystent ESN')
    return jsonify({'configured': bool(own or j.get('server_configured')), 'name': name + (' (Twój klucz)' if own else ''),
                    'own_key': own, 'limit': j.get('limit'), 'used': j.get('used'), 'remaining': j.get('remaining')})

# ─── START ────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)