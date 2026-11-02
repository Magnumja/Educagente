"""Configuração única, lida do ambiente (`backend/.env` ou Compose).

DJANGO_DEBUG=1 é o modo local (runserver); com 0 (padrão, usado no Docker) a
DJANGO_SECRET_KEY passa a ser obrigatória.
"""
import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DEBUG = os.getenv("DJANGO_DEBUG", "0") == "1"
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY") or ("somente-desenvolvimento-local" if DEBUG else "")
if not SECRET_KEY:
    raise ImproperlyConfigured("Defina DJANGO_SECRET_KEY no backend/.env (obrigatória com DJANGO_DEBUG=0).")
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "oficina",
    "projetos",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "educagente.urls"
WSGI_APPLICATION = "educagente.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# Banco, índices JSONL e uploads ficam em data/ (volume do Docker).
DATA_DIR = Path(os.getenv("EDUCAGENTE_DATA_DIR", BASE_DIR / "data"))
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": DATA_DIR / "educagente.sqlite3",
        "OPTIONS": {"timeout": 20},
    }
}
LEGACY_DB_PATH = DATA_DIR / "oficina.db"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Campo_Grande"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# RAG e provedores de chat
MODEL_PROVIDER = os.getenv("MODEL_PROVIDER", "anthropic")
LLM_MODEL = os.getenv("LLM_MODEL", "llama3.2:1b" if MODEL_PROVIDER == "ollama" else "claude-haiku-5-5")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "bge-m3")
TOP_K = int(os.getenv("TOP_K", "4"))
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.5"))
