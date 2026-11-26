"""Tłumaczenia: spójność słowników, użycie kluczy, kopie rdzenia w magazynie."""
import re
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
BASE = "pl"


def _dicts(root: Path):
    """{kod: {klucz: tekst}} ze wszystkich plików root/i18n/*.js."""
    out = {}
    for f in sorted((root / "i18n").glob("*.js")):
        src = f.read_text(encoding="utf-8")
        out[f.stem] = dict(re.findall(r'"([\w.]+)"\s*:\s*"((?:[^"\\]|\\.)*)"', src))
    return out


def _placeholders(s):
    return sorted(re.findall(r"\{(\w+)\}", s))


def _check(root: Path):
    d = _dicts(root)
    assert BASE in d, "brak słownika bazowego"
    base = d[BASE]
    for code, dic in d.items():
        missing = set(base) - set(dic)
        extra = set(dic) - set(base)
        assert not missing, f"{code}: brak kluczy {sorted(missing)[:5]}"
        assert not extra, f"{code}: klucze spoza bazowego {sorted(extra)[:5]}"
        for k, v in dic.items():
            assert v.strip(), f"{code}.{k} puste"
            assert _placeholders(v) == _placeholders(base[k]), f"{code}.{k}: różne {{parametry}}"
    return d


def test_portal_dictionaries_consistent():
    _check(APP / "static")


def test_magazyn_dictionaries_consistent():
    _check(APP / "esn_magazyn" / "static")


def test_every_language_file_is_loaded_by_templates():
    for root, tpl in ((APP / "static", "templates/index.html"), (APP / "esn_magazyn" / "static", "esn_magazyn/templates/index.html")):
        html = (APP / tpl).read_text(encoding="utf-8")
        assert "i18n.js" in html
        for code in _dicts(root):
            assert f"i18n/{code}.js" in html, f"{tpl}: brak <script> dla {code}"
        assert html.index("i18n.js") < html.index("i18n/pl.js") < html.index("theme.js")


def test_keys_used_in_templates_exist():
    base = _dicts(APP / "static")[BASE]
    html = (APP / "templates" / "index.html").read_text(encoding="utf-8")
    used = set(re.findall(r'data-i18n="([\w.]+)"', html)) | set(re.findall(r"data-i18n-attr=\"[^\"]*?:([\w.]+)", html)) | set(re.findall(r"\b_?t\('([\w.]+)'", html))
    assert used and not (used - set(base)), sorted(used - set(base))
    mbase = _dicts(APP / "esn_magazyn" / "static")[BASE]
    mhtml = (APP / "esn_magazyn" / "templates" / "index.html").read_text(encoding="utf-8")
    mused = set(re.findall(r'data-i18n="([\w.]+)"', mhtml)) | set(re.findall(r"data-i18n-attr=\"[^\"]*?:([\w.]+)", mhtml))
    assert mused and not (mused - set(mbase)), sorted(mused - set(mbase))


def test_ai_settings_keys_exist():
    base = _dicts(APP / "static")[BASE]
    js = (APP / "static" / "ai-settings.js").read_text(encoding="utf-8")
    keys = re.search(r"\[((?:\"\w+\",?\s*)+)\]\.forEach", js).group(1)
    for k in re.findall(r"\"(\w+)\"", keys):
        assert f"ai.{k}" in base, k


def test_core_copied_to_magazyn():
    for f in ("i18n.js", "theme.js"):
        assert (APP / "static" / f).read_text(encoding="utf-8") == (APP / "esn_magazyn" / "static" / f).read_text(encoding="utf-8"), f


def _keys_in_dict(root: Path):
    return set(_dicts(root)[BASE])


def test_no_duplicate_keys_in_dictionaries():
    for root in (APP / "static", APP / "esn_magazyn" / "static"):
        for f in (root / "i18n").glob("*.js"):
            keys = re.findall(r'^\s*"([\w.]+)"\s*:', f.read_text(encoding="utf-8"), re.M)
            dup = {k for k in keys if keys.count(k) > 1}
            assert not dup, f"{f.name}: zdublowane klucze {sorted(dup)[:5]}"


def test_keys_used_in_modules_exist():
    """_t('klucz') / _tn('klucz', n) w static/*.js i szablonach (z formami liczby mnogiej)."""
    keys = _keys_in_dict(APP / "static")
    files = list((APP / "static").glob("*.js")) + [APP / "templates" / "index.html"]
    for f in files:
        src = f.read_text(encoding="utf-8")
        for k in re.findall(r"""\b_t\(\s*['"]([\w.]+)['"]""", src):
            assert k in keys, f"{f.name}: brak klucza {k}"
        for k in re.findall(r"""\b_tn\(\s*['"]([\w.]+)['"]""", src):
            assert (k + ".other") in keys, f"{f.name}: brak form liczby mnogiej {k}"


def test_magazyn_template_keys_exist():
    keys = _keys_in_dict(APP / "esn_magazyn" / "static")
    srcs = [(APP / "esn_magazyn" / "templates" / "index.html"), (APP / "esn_magazyn" / "static" / "ai-local.js")]
    for f in srcs:
        s = f.read_text(encoding="utf-8")
        used = set(re.findall(r"""\b_?t\(\s*['"]([\w.]+)['"]""", s)) | set(re.findall(r'data-i18n="([\w.]+)"', s))
        for attr in re.findall(r'data-i18n-attr="([^"]*)"', s):
            used |= {p.split(":", 1)[1].strip() for p in attr.split(";") if ":" in p}
        miss = {k for k in used if k not in keys}
        assert not miss, f"{f.name}: brak kluczy w słowniku magazynu {sorted(miss)[:5]}"


def test_api_error_patterns_cover_backend_messages():
    """Każdy stały komunikat detail="..." z backendu portalu ma wzorzec api.* (tłumaczenie błędów)."""
    base = _dicts(APP / "static")[BASE]
    pats = []
    for k, v in base.items():
        if k.startswith("api."):
            parts = re.split(r"\{\w+\}", v)
            pats.append(re.compile("^" + "(.+?)".join(re.escape(p) for p in parts) + "$"))
    uncovered = []
    for f in APP.glob("*.py"):
        for m in re.finditer(r'detail=(f?)"([^"{}]*)"', f.read_text(encoding="utf-8")):
            if m.group(1):
                continue
            msg = m.group(2)
            if not any(p.match(msg) for p in pats):
                uncovered.append(msg)
    assert not uncovered, f"komunikaty bez wzorca api.*: {sorted(set(uncovered))[:5]}"
