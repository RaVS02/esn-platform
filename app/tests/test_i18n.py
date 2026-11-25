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
    used = set(re.findall(r'data-i18n="([\w.]+)"', html)) | set(re.findall(r"data-i18n-attr=\"[^\"]*?:([\w.]+)", html)) | set(re.findall(r"\bt\('([\w.]+)'", html))
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
