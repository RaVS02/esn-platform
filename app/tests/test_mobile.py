"""Okablowanie układu mobilnego (portal i magazyn)."""
from pathlib import Path

APP = Path(__file__).resolve().parent.parent


def _r(p):
    return (APP / p).read_text(encoding="utf-8")


def test_portal_mobile_wiring():
    html = _r("templates/index.html")
    assert "/mobile.css" in html
    assert html.index("style.css") < html.index("mobile.css")
    assert 'id="tabbar"' in html and "navAccBtn" in html
    css = _r("static/mobile.css")
    assert "max-width: 820px" in css and ".tabbar" in css


def test_magazyn_mobile_wiring():
    html = _r("esn_magazyn/templates/index.html")
    assert "mobile.css" in html and html.index("magazyn.css") < html.index("mobile.css")
    for needle in ('id="tabbar"', 'id="sidebar"', 'id="sb-backdrop"', "function toggleSidebar"):
        assert needle in html
    css = _r("esn_magazyn/static/mobile.css")
    assert "max-width: 820px" in css and ".sb-backdrop" in css
