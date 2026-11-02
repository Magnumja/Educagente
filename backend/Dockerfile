FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# Estáticos do admin e da documentação da API, servidos pelo whitenoise.
RUN DJANGO_SECRET_KEY=somente-para-collectstatic python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["./entrypoint.sh"]
