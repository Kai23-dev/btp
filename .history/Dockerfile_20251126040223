FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 
WORKDIR /app

# Install system dependencies (if needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . /app

EXPOSE 5000

# Use gunicorn for production. Bind to the runtime $PORT (Render sets this).
ENV PORT=5000
# Use shell form so $PORT is expanded at container runtime
CMD gunicorn --bind 0.0.0.0:${PORT} app:app --workers 4 --timeout 120
