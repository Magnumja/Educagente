#!/usr/bin/env bash
# Modo local, sem Docker: API Django (runserver, porta 8000) e site (Vite, porta 5173).
set -e
cd "$(dirname "$0")"

[ -d backend/.venv ] || python3 -m venv backend/.venv
backend/.venv/bin/pip install -q -r backend/requirements.txt
[ -f backend/.env ] || cp backend/.env.example backend/.env
[ -d frontend/node_modules ] || (cd frontend && npm install)

export DJANGO_DEBUG=1
(cd backend && .venv/bin/python manage.py migrate --noinput && .venv/bin/python manage.py importar_banco_legado)
(cd backend && .venv/bin/python manage.py runserver 0.0.0.0:8000) &
BACK=$!
trap 'kill $BACK 2>/dev/null' EXIT

cd frontend && npm run dev
