import os
import smtplib
import random
import bcrypt
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def _env(*names, default=""):
    """Pierwsza ustawiona (niepusta) zmienna ze środowiska; obsługuje oba nazewnictwa: MAIL_* (z .env projektu) i SMTP_*."""
    for n in names:
        v = os.getenv(n)
        if v is not None and v.strip() != "":
            return v.strip().strip('"').strip("'")
    return default


class MailBot:
    def __init__(self):
        # Dane dostępowe wyłącznie ze zmiennych środowiskowych (.env) – nigdy w kodzie ani w repozytorium.
        # MAIL_PASSWORD to 16-znakowe hasło aplikacji Google (spacje są ignorowane). Zamienniki: SMTP_*.
        self.smtp_server = _env("MAIL_SERVER", "SMTP_SERVER", default="smtp.gmail.com")
        self.smtp_port = int(_env("MAIL_PORT", "SMTP_PORT", default="465"))
        self.smtp_user = _env("MAIL_USERNAME", "SMTP_USER")
        self.smtp_password = _env("MAIL_PASSWORD", "SMTP_PASSWORD").replace(" ", "")
        self.sender_email = _env("MAIL_FROM", "SMTP_FROM") or self.smtp_user

    def generate_code(self):
        return str(random.randint(100000, 999999))

    def configured(self):
        return bool(self.smtp_user and self.smtp_password)

    def send_email(self, receiver_email, subject, body):
        if not self.configured():
            print("MailBot: brak MAIL_USERNAME/MAIL_PASSWORD w .env – e-mail nie został wysłany")
            return False
        msg = MIMEMultipart()
        msg['From'] = self.sender_email
        msg['To'] = receiver_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain', 'utf-8'))

        try:
            with smtplib.SMTP_SSL(self.smtp_server, self.smtp_port) as server:
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            return True
        except Exception as e:
            print(f"Błąd MailBota: {e}")
            return False

# --- Szyfrowanie rodem z HotWheels ---

def hash_password(password: str):
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))