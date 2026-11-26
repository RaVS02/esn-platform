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
require(process.argv[2]); require(process.argv[3]); require(process.argv[4]); require(process.argv[5]);
const M = ESNCalc.math, B = ESNCalcBasic, out = {};
out.parse = ['4k7', '2R2', '4u7', '1,5', '100n', '10 k', '3.3V', '10kΩ', '1M', '1m', 'abc', '', '100N'].map(s => { const r = M.parse(s); return r ? r.v : null; });
out.near = [M.nearest('E12', 4700), M.nearest('E12', 5000), M.nearest('E12', 150.5, 'up'), M.nearest('E24', 0.33), M.nearest('E96', 10100)];
out.ohm = B.ohm({ U: 5, I: 0.02 }); out.ohm2 = B.ohm({ R: 100, P: 0.25 });
out.div = B.pickDivider(5, 3.3, 'E24', 1e4, 1e5, 3);
out.dec = [B.decode({ digits: ['yellow', 'violet'], mult: 'red' }), B.decode({ digits: ['brown', 'black', 'black'], mult: 'brown' }), B.decode({ digits: ['red', 'red'], mult: 'gold' })];
out.enc = [B.encode(4700, 2), B.encode(4750, 2), B.encode(1e3, 3), B.encode(0.47, 2)];
out.pr = [M.powerRating(0.06), M.powerRating(0.2), M.powerRating(100)];
out.fmt = [M.fmt(4700, 'Ω'), M.fmt(0.02, 'A'), M.fmt(1.2e-6, 'F')];
const P = ESNCalcParts, K = ESNCalcComm;
out.comb = [P.combine('R', 'ser', [1000, 2200]), P.combine('R', 'par', [1000, 1000]), P.combine('C', 'par', [1e-7, 4.7e-8]), P.combine('C', 'ser', [1e-7, 1e-7]), P.combine('L', 'par', [1e-5, 1e-5])];
out.pair = P.pickPair('R', 'ser', 4400, 'E12', 3); out.pairPar = P.pickPair('R', 'par', 5000, 'E24', 3); out.pairC = P.pickPair('C', 'par', 1.5e-7, 'E6', 3);
out.cap = ['104', '104K', '473J', '4n7', '2u2', '4R7', '47', '0.1', '229', 'xyz'].map(c => { const r = P.capDecode(c); return r ? [r.F, r.tol] : null; });
out.capE = [P.capEncode(1e-7), P.capEncode(4.7e-9), P.capEncode(4.7e-12), P.capEncode(4.75e-9)];
out.rkm = [P.rkm(4.7e-9), P.rkm(1e-7), P.rkm(2.2e-6)];
out.frame = K.uartFrame(8, 'N', 1); out.udiv = K.uartDiv(16e6, 115200, 16); out.div2 = K.uartDiv(16e6, 9600, 16);
out.tm = K.timer(16e6, 1000, 16, 'avr')[0]; out.tm8 = K.timer(16e6, 1000, 8, 'avr')[0]; out.ledc = K.ledcBits(5000);
out.rc = K.rc(1e4, 1e-7); out.rcAt = K.rcAt(1e4, 1e-7, 1 / (2 * Math.PI * 1e-3), 'lp');
console.log(JSON.stringify(out));
"""


@pytest.fixture(scope="module")
def r(tmp_path_factory):
    if not NODE:
        pytest.skip("brak node")
    h = tmp_path_factory.mktemp("calc") / "h.js"
    h.write_text(HARNESS, encoding="utf-8")
    p = subprocess.run([NODE, str(h)] + [str(STATIC / f) for f in ("calc.js", "calc-basic.js", "calc-parts.js", "calc-comm.js")], capture_output=True, text=True, timeout=30)
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
    assert html.index("/tools.js") < html.index("/calc.js") < html.index("/calc-basic.js") < html.index("/calc-parts.js") < html.index("/calc-comm.js")
    assert "/calc.css" in html


def test_combine_and_pairs(r):
    c = r["comb"]
    assert approx(c[0], 3200) and approx(c[1], 500) and approx(c[2], 1.47e-7) and approx(c[3], 5e-8) and approx(c[4], 5e-6)
    assert r["pair"] and abs(r["pair"][0]["err"]) < 0.01 and approx(r["pair"][0]["a"] + r["pair"][0]["b"], r["pair"][0]["total"])
    p = r["pairPar"][0]
    assert abs(p["err"]) < 0.01 and approx(p["a"] * p["b"] / (p["a"] + p["b"]), p["total"])
    assert approx(r["pairC"][0]["total"], 1.5e-7, 0.01)


def test_capacitor_code(r):
    cap = r["cap"]
    assert approx(cap[0][0], 1e-7) and cap[0][1] is None
    assert approx(cap[1][0], 1e-7) and cap[1][1] == "K"
    assert approx(cap[2][0], 4.7e-8) and cap[2][1] == "J"
    assert approx(cap[3][0], 4.7e-9) and approx(cap[4][0], 2.2e-6) and approx(cap[5][0], 4.7e-12)
    assert approx(cap[6][0], 4.7e-11) and approx(cap[7][0], 1e-7) and approx(cap[8][0], 2.2e-12) and cap[9] is None
    e = r["capE"]
    assert e[0]["code"] == "104" and e[1]["code"] == "472" and e[2]["code"] == "4R7" and not e[3]["exact"]
    assert r["rkm"] == ["4n7", "100n", "2u2"]


def test_uart_timer_rc(r):
    assert r["frame"] == 10
    assert r["udiv"]["ubrr"] == 8 and abs(r["udiv"]["err"] + 0.0351) < 0.001     # 16 MHz / 115200: −3,5 %
    assert r["div2"]["ubrr"] == 103 and abs(r["div2"]["err"]) < 0.002
    assert r["tm"]["psc"] == 1 and r["tm"]["top"] == 15999 and approx(r["tm"]["real"], 1000)
    assert r["tm8"]["psc"] == 64 and r["tm8"]["top"] == 249
    assert r["ledc"] == 13
    assert approx(r["rc"]["tau"], 1e-3) and approx(r["rc"]["fc"], 159.1549, 1e-5)
    assert abs(r["rcAt"]["db"] + 3.0103) < 0.001 and abs(r["rcAt"]["phase"] + 45) < 1e-6
