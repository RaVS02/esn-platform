import smtplib
import random
import bcrypt
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

class MailBot:
    def __init__(self):
        # Użyj swojego nowego, 16-znakowego hasła aplikacji z Google!
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 465
        self.smtp_user = "notifications.rs.projects@gmail.com" 
        self.smtp_password = "fnhw veuu nkfm bmvp"
        self.sender_email = self.smtp_user

    def generate_code(self):
        return str(random.randint(100000, 999999))

    def send_email(self, receiver_email, subject, body):
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