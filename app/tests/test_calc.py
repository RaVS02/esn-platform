"""Kalkulatory (v51): matematyka z calc.js / calc-basic.js uruchamiana w Node (bez przeglądarki)."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

STATIC = Path(__file__).resolve().parent.parent / "static"
NODE = shutil.which("node")

HARNESS = r"""
global.window = global; global.localStorage = { getItem: () => null, setItem: () => {} };
global.ESNI18n = { t: k => k, lang: () => 'en' };
global.ESNTools = { register: () => {} };
require(process.argv[2]); require(process.argv[3]);
const M = ESNCalc.math, B = ESNCalcBasic, out = {};
out.parse = ['4k7', '2R2', '4u7', '1,5', '100n', '10 k', '3.3V', '10kΩ', '1M', '1m', 'abc', '', '100N'].map(s => { const r = M.parse(s); return r ? r.v : null; });
out.near = [M.nearest('E12', 4700), M.nearest('E12', 5000), M.nearest('E12', 150.5, 'up'), M.nearest('E24', 0.33), M.nearest('E96', 10100)];
out.ohm = B.ohm({ U: 5, I: 0.02 }); out.ohm2 = B.ohm({ R: 100, P: 0.25 });
out.div = B.pickDivider(5, 3.3, 'E24', 1e4, 1e5, 3);
out.dec = [B.decode({ digits: ['yellow', 'violet'], mult: 'red' }), B.decode({ digits: ['brown', 'black', 'black'], mult: 'brown' }), B.decode({ digits: ['red', 'red'], mult: 'gold' })];
out.enc = [B.encode(4700, 2), B.encode(4750, 2), B.encode(1e3, 3), B.encode(0.47, 2)];
out.pr = [M.powerRating(0.06), M.powerRating(0.2), M.powerRating(100)];
out.fmt = [M.fmt(4700, 'Ω'), M.fmt(0.02, 'A'), M.fmt(1.2e-6, 'F')];
console.log(JSON.stringify(out));
"""


@pytest.fixture(scope="module")
def r(tmp_path_factory):
    if not NODE:
        pytest.skip("brak node")
    h = tmp_path_factory.mktemp("calc") / "h.js"
    h.write_text(HARNESS, encoding="utf-8")
    p = subprocess.run([NODE, str(h), str(STATIC / "calc.js"), str(STATIC / "calc-basic.js")], capture_output=True, text=True, timeout=30)
    assert p.returncode == 0, p.stderr
    return json.loads(p.stdout)


def approx(a, b, rel=1e-6):
    return a is not None and abs(a - b) <= rel * abs(b)


def test_parse_prefixes(r):
    exp = [4700, 2.2, 4.7e-6, 1.5, 1e-7, 1e4, 3.3, 1e4, 1e6, 1e-3, None, None, 1e-7]
    for got, want in zip(r["parse"], exp):
        assert (got is None and want is None) or approx(got, want), (got, want)


def test_eseries_nearest(r):
    assert r["near"] == [4700, 4700, 180, 0.33, 10200]   # 10,1 k: 10,2 k bliżej (logarytmicznie) niż 10,0 k


def test_ohm(r):
    assert approx(r["ohm"]["R"], 250) and approx(r["ohm"]["P"], 0.1)
    assert approx(r["ohm2"]["U"], 5) and approx(r["ohm2"]["I"], 0.05)


def test_divider_pick(r):
    d = r["div"]
    assert d and abs(d[0]["err"]) < 0.01
    assert all(1e4 <= c["tot"] <= 1e5 for c in d)
    assert abs(d[0]["err"]) <= abs(d[-1]["err"])
    assert approx(5 * d[0]["r2"] / (d[0]["r1"] + d[0]["r2"]), d[0]["u"])


def test_color_code(r):
    assert r["dec"] == [4700, 1000, 2.2]
    e = r["enc"]
    assert e[0]["digits"] == ["yellow", "violet"] and e[0]["mult"] == "red" and e[0]["exact"]
    assert not e[1]["exact"] and e[1]["value"] == 4800
    assert e[2]["digits"] == ["brown", "black", "black"] and e[2]["mult"] == "brown"
    assert e[3]["mult"] == "silver" and e[3]["digits"] == ["yellow", "violet"]


def test_power_rating_and_format(r):
    assert r["pr"] == [0.125, 0.5, None]
    assert r["fmt"] == ["4.7 kΩ", "20 mA", "1.2 µF"]


def test_calc_scripts_loaded_in_order():
    html = (STATIC.parent / "templates" / "index.html").read_text(encoding="utf-8")
    assert html.index("/tools.js") < html.index("/calc.js") < html.index("/calc-basic.js")
    assert "/calc.css" in html
