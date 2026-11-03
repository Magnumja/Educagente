#!/usr/bin/env bash
# Modo local, sem Docker: API Django (porta 8000) e site no Vite (porta 5173, com recarga).
# Sem Ollama nem chave? Rode com MODEL_PROVIDER=demo EMBEDDING_PROVIDER=local ./iniciar.sh
set -e
cd "$(dirname "$0")"

PY=python3; command -v python3 >/dev/null || PY=python
[ -d backend/.venv ] || $PY -m venv backend/.venv
BIN=backend/.venv/bin; [ -d "$BIN" ] || BIN=backend/.venv/Scripts   # Windows (Git Bash)
"$BIN/pip" install -q -r backend/requirements.txt
[ -f backend/.env ] || cp backend/.env.example backend/.env
[ -d frontend/node_modules ] || (cd frontend && npm install)

export DJANGO_DEBUG=1
(cd backend && "../$BIN/python" manage.py migrate --noinput)
(cd backend && "../$BIN/python" manage.py runserver 0.0.0.0:8000) &
BACK=$!
trap 'kill $BACK 2>/dev/null' EXIT

cd frontend && npm run dev
