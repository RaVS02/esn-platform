"""Sekrety tylko w .env: brak haseł w kodzie, MailBot czyta konfigurację ze środowiska."""
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

APP = Path(__file__).resolve().parents[1]
PATTERNS = [
    (re.compile(r"""(?i)(smtp_password|password|passwd|secret|api_key|apikey)\s*=\s*["'][^"'\s][^"']{7,}["']"""), "stały sekret w kodzie"),
    (re.compile(r"AIza[0-9A-Za-z_\-]{30,}"), "klucz Google API"),
    (re.compile(r"sk-[A-Za-z0-9_\-]{20,}"), "klucz API (sk-…)"),
]
ALLOWED = ("lokalne_haslo_zmien_w_env", "brak_klucza_w_env_file")   # jawne wartości domyślne/zastępcze


def test_no_hardcoded_secrets():
    bad = []
    for f in list(APP.glob("*.py")) + list((APP / "esn_magazyn").glob("*.py")):
        for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            if any(a in line for a in ALLOWED):
                continue
            for rx, what in PATTERNS:
                if rx.search(line):
                    bad.append(f"{f.name}:{i} {what}")
    assert not bad, "Sekrety w kodzie: " + "; ".join(bad)


def test_mailbot_reads_env(monkeypatch):
    import utils
    for k in ("SMTP_USER", "SMTP_PASSWORD", "SMTP_SERVER", "SMTP_PORT", "SMTP_FROM",
              "MAIL_USERNAME", "MAIL_PASSWORD", "MAIL_SERVER", "MAIL_PORT", "MAIL_FROM"):
        monkeypatch.delenv(k, raising=False)
    m = utils.MailBot()
    assert not m.configured() and m.send_email("a@b.c", "t", "b") is False   # bez konfiguracji – brak wysyłki, brak wyjątku
    monkeypatch.setenv("SMTP_USER", "bot@example.test")
    monkeypatch.setenv("SMTP_PASSWORD", "abcd efgh ijkl mnop")
    monkeypatch.setenv("SMTP_PORT", "587")
    m = utils.MailBot()
    assert m.configured() and m.smtp_user == "bot@example.test" and m.smtp_password == "abcdefghijklmnop" and m.smtp_port == 587
    # nazwy MAIL_* (z .env projektu) mają pierwszeństwo, wartości w cudzysłowach są czyszczone
    monkeypatch.setenv("MAIL_USERNAME", '"mail@example.test"')
    monkeypatch.setenv("MAIL_PASSWORD", '"wxyz wxyz wxyz wxyz"')
    m = utils.MailBot()
    assert m.smtp_user == "mail@example.test" and m.smtp_password == "wxyzwxyzwxyzwxyz"
