import os
from datetime import datetime, timedelta
from jose import jwt
from fastapi import HTTPException, status

# TAJNY KLUCZ - nie udostępniaj go nikomu!
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "brak_klucza_w_env_file!")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 godziny

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)