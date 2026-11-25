"""Spójność motywów jasny/ciemny: obie palety definiują te same zmienne, a CSS nie używa niezdefiniowanych."""
import re
from pathlib import Path

STATIC = Path(__file__).resolve().parent.parent / "static"
DYNAMIC = {"--c", "--cat-color"}  # ustawiane z JS (kolor pinu, kolor kategorii w magazynie)
CSS = ["style.css", "knowledge.css", "content.css", "media.css", "pinout.css"]


def _block(css, start):
    i = css.index(start)
    j = css.index("}", i)
    return css[i:j]


def _vars(block):
    return set(re.findall(r"(--[a-z0-9-]+)\s*:", block))


def test_palettes_define_same_variables():
    css = (STATIC / "style.css").read_text(encoding="utf-8")
    dark = _vars(_block(css, ":root {"))
    light = _vars(_block(css, ':root[data-theme="light"] {'))
    island = _vars(_block(css, ':root[data-theme="light"] .dark-island'))
    palette = {v for v in dark if v not in ("--mono", "--sans", "--display")}
    assert palette == light, (palette ^ light)
    assert palette == island, (palette ^ island)


def test_css_uses_only_defined_variables():
    defined = _vars((STATIC / "style.css").read_text(encoding="utf-8"))
    for name in CSS:
        text = (STATIC / name).read_text(encoding="utf-8")
        used = set(re.findall(r"var\((--[a-z0-9-]+)", text))
        local = _vars(text)
        missing = {u for u in used if u not in defined and u not in local and u not in DYNAMIC}
        assert not missing, (name, missing)


def test_no_hardcoded_accent_tints_left():
    """Półprzezroczyste tła w kolorach akcentów mają używać zmiennych *-rgb (inaczej nie zmienią się w jasnym motywie)."""
    bad = re.compile(r"rgba\(\s*(0,\s*212,\s*255|86,\s*225,\s*253|0,\s*255,\s*136|255,\s*140,\s*0|255,\s*68,\s*102|157,\s*111,\s*255)\s*,")
    for name in ("style.css", "knowledge.css", "content.css"):
        text = (STATIC / name).read_text(encoding="utf-8")
        # paleta w :root jest dozwolona jako zapis kanałów, ale nie jako rgba()
        assert not bad.search(text), name


def test_theme_script_and_toggle_present():
    js = (STATIC / "theme.js").read_text(encoding="utf-8")
    for needle in ("esn-theme", "prefers-color-scheme", "data-theme", "ESNTheme"):
        assert needle in js
    html = (STATIC.parent / "templates" / "index.html").read_text(encoding="utf-8")
    assert "theme.js" in html and 'id="themeToggle"' in html


def test_magazyn_has_light_theme_and_same_theme_script():
    mag = STATIC.parent / "esn_magazyn"
    css = (mag / "static" / "magazyn.css").read_text(encoding="utf-8")
    dark = _vars(_block(css, ":root {"))
    light = _vars(_block(css, ':root[data-theme="light"] {'))
    assert {v for v in dark if v not in ("--mono", "--sans", "--display")} == light
    defined = _vars(css)
    used = set(re.findall(r"var\((--[a-z0-9-]+)", css))
    assert not {u for u in used if u not in defined and u not in DYNAMIC}
    # magazyn ma własną kopię theme.js (inny katalog statyczny) – muszą być identyczne
    assert (mag / "static" / "theme.js").read_text(encoding="utf-8") == (STATIC / "theme.js").read_text(encoding="utf-8")
    html = (mag / "templates" / "index.html").read_text(encoding="utf-8")
    assert "theme.js" in html and 'id="themeToggle"' in html


def test_widget_palette_complete():
    js = (STATIC / "knowledge.js").read_text(encoding="utf-8")
    body = js[js.index("var WIDGET_PAL = {"):js.index("var WIDGET_HEX")]
    pairs = re.findall(r'(\w+): \["(#[0-9a-f]{6})", "(#[0-9a-f]{6})"\]', body)
    assert len(pairs) >= 15
    darks = [d for _, d, _ in pairs]
    assert len(set(darks)) == len(darks), "ciemne kolory palety widgetów muszą być unikalne (mapowanie #hex -> zmienna)"
    # każdy kolor użyty w widgetach z archiwum jest w palecie albo jest świadomie spoza niej
    import glob
    known = set(darks)
    for f in glob.glob(str(STATIC.parent / "knowledge_batch_v*.py")):
        text = open(f, encoding="utf-8").read()
        for hx in set(h.lower() for h in re.findall(r"#[0-9a-fA-F]{6}\b", text)):
            assert hx in known, (f, hx)


def test_ai_local_copy_identical_and_included():
    """ai-local.js (model lokalny) ma kopię w magazynie; oba szablony go ładują."""
    mag = STATIC.parent / "esn_magazyn"
    assert (mag / "static" / "ai-local.js").read_text(encoding="utf-8") == (STATIC / "ai-local.js").read_text(encoding="utf-8")
    assert "ai-local.js" in (mag / "templates" / "index.html").read_text(encoding="utf-8")
    portal = (STATIC.parent / "templates" / "index.html").read_text(encoding="utf-8")
    assert "ai-local.js" in portal and "ai-settings.js" in portal and 'id="ai-settings-card"' in portal
