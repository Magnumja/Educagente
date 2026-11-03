# Imagem única: compila o site (Vite) e o entrega junto com a API Django.
# Contexto de build: a raiz do repositório (ver docker-compose.yml).

FROM node:22-slim AS site
WORKDIR /site
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FRONTEND_DIST=/app/site
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=site /site/dist /app/site
# Estáticos do admin, servidos pelo whitenoise.
RUN DJANGO_SECRET_KEY=somente-para-collectstatic python manage.py collectstatic --noinput \
    && useradd --create-home educagente && mkdir -p /app/data && chown -R educagente /app/data
USER educagente
EXPOSE 8000
CMD ["sh", "./entrypoint.sh"]
