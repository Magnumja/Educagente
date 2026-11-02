#!/bin/sh
# Prepara o banco e sobe a API. A importação do banco legado é idempotente: na
# primeira subida copia data/oficina.db; nas seguintes não faz nada.
set -e

python manage.py migrate --noinput
python manage.py importar_banco_legado

# Threads porque cada pergunta espera a LLM; timeout alto para o Ollama em CPU.
exec gunicorn educagente.wsgi \
  --bind 0.0.0.0:8000 \
  --workers 2 \
  --threads 4 \
  --timeout 300 \
  --access-logfile -
