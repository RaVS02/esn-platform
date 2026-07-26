FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Uruchamiamy Flaska na porcie 5000
CMD ["python", "app.py"]