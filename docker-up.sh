#!/usr/bin/env bash
# Sobe a API (Django) em Docker, garantindo antes que o Ollama do host está acessível
# pelo container (ver ollama.sh). Não sobe o frontend — rode à parte com
# `cd frontend && npm run dev`.
set -e
cd "$(dirname "$0")"

[ -f backend/.env ] || cp backend/.env.example backend/.env
# Com DJANGO_DEBUG=0 o Django exige uma chave secreta: gera uma só na primeira vez.
if ! grep -qE '^DJANGO_SECRET_KEY=.+' backend/.env; then
  sed -i '/^DJANGO_SECRET_KEY=$/d' backend/.env
  echo "DJANGO_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')" >> backend/.env
  echo "Gerei uma DJANGO_SECRET_KEY em backend/.env."
fi

./ollama.sh

# Na subida o container roda as migrations e importa data/oficina.db (só na primeira vez).
docker compose up --build -d

echo "Aguardando a API..."
for _ in $(seq 30); do
  curl -fs http://localhost:8000/api/saude > /dev/null && break
  sleep 2
done
curl -fs http://localhost:8000/api/saude && echo
echo "API em http://localhost:8000 — admin em /admin, documentação em /api/docs"
