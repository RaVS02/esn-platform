"""Wiadomości e-mail w języku odbiorcy.

Język ustala `request_lang`: nagłówek X-ESN-Lang (wysyła go przeglądarka, patrz i18n.js) → Accept-Language →
zapisany język użytkownika (`users.lang`) → polski. Nowy język = nowy wpis w MAILS (+ kod w MAIL_LANGS).
Powiadomienie formularza kontaktowego trafia do administratora, więc zawsze jest po polsku.
"""
MAIL_LANGS = ("pl", "en")
BASE = "pl"

MAILS = {
    "pl": {
        "register_subject": "Weryfikacja konta - ESN Platform",
        "register_body": ("Witaj {username}!\n\nTwój Login: {login}\n\nTwój kod weryfikacyjny to: {code}\n\n"
                          "Jeśli to nie Ty zakładałeś konto, prosimy o zignorowanie tej wiadomości.\n\nPozdrawiamy,\nZespół ESN Platform"),
        "reset_subject": "Odzyskiwanie dostępu - ESN Platform",
        "reset_body": ("Witaj {username}!\n\nPrzypominamy, że Twój Login ID to: {login}\n\n"
                       "Twój kod do zresetowania hasła to: {code}\nKod jest ważny przez 15 minut."),
        "code_subject": "Kod autoryzacyjny: {purpose}",
        "code_body": "Twój kod to: {code}\nWażny przez 15 minut.",
        "purposes": {"email": "zmiany adresu e-mail", "password": "zmiany hasła", "delete": "usunięcia konta", "other": "akcji w systemie"},
    },
    "en": {
        "register_subject": "Account verification - ESN Platform",
        "register_body": ("Hello {username}!\n\nYour login: {login}\n\nYour verification code is: {code}\n\n"
                          "If you did not create this account, please ignore this message.\n\nBest regards,\nThe ESN Platform Team"),
        "reset_subject": "Account recovery - ESN Platform",
        "reset_body": ("Hello {username}!\n\nA reminder: your Login ID is: {login}\n\n"
                       "Your password reset code is: {code}\nThe code is valid for 15 minutes."),
        "code_subject": "Authorization code: {purpose}",
        "code_body": "Your code is: {code}\nValid for 15 minutes.",
        "purposes": {"email": "changing your e-mail address", "password": "changing your password", "delete": "deleting your account", "other": "an action in the system"},
    },
}


def norm(value):
    """Kod języka ('en-GB,en;q=0.9' → 'en') albo None, gdy nieobsługiwany."""
    for part in str(value or "").split(","):
        code = part.split(";")[0].strip().lower().split("-")[0]
        if code in MAIL_LANGS:
            return code
    return None


def request_lang(request, user_lang=None):
    h = request.headers if request is not None else {}
    return norm(h.get("x-esn-lang")) or norm(h.get("accept-language")) or norm(user_lang) or BASE


def render(lang, name, **params):
    d = MAILS.get(lang) or MAILS[BASE]
    return d[name].format(**params)


def purpose_label(lang, purpose):
    p = (MAILS.get(lang) or MAILS[BASE])["purposes"]
    return p.get(purpose) or p["other"]
