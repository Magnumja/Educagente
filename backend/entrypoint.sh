#!/bin/sh
# Prepara o banco e sobe a API (que também entrega o site compilado).
set -e

python manage.py migrate --noinput

# Threads porque cada pergunta espera a LLM; timeout alto para o Ollama em CPU.
exec gunicorn educagente.wsgi \
  --bind 0.0.0.0:8000 \
  --workers 2 \
  --threads 4 \
  --timeout 180 \
  --access-logfile -
