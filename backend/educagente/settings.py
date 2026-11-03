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
# "*" é aceitável no laboratório (rede local, acesso pelo IP do professor).
ALLOWED_HOSTS = [h.strip() for h in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "oficinas",
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

# Banco (com trechos e embeddings) fica em data/ (volume do Docker).
DATA_DIR = Path(os.getenv("EDUCAGENTE_DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": DATA_DIR / "educagente.sqlite3",
        "OPTIONS": {"timeout": 20, "init_command": "PRAGMA journal_mode=WAL;"},
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Campo_Grande"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# Site compilado (Vite). No Docker o build do frontend é copiado para cá.
FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", BASE_DIR.parent / "frontend" / "dist"))
WHITENOISE_ROOT = FRONTEND_DIST if FRONTEND_DIST.exists() else None

# Uploads: 5 MB por arquivo (conferido também no caso de uso).
DATA_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
# Limites de uso por IP: só o REMOTE_ADDR conta (X-Forwarded-For pode ser forjado).
NINJA_NUM_PROXIES = 0

# Produção na internet: o Caddy (docker-compose.prod.yml) termina o HTTPS e repassa para cá.
# No laboratório (HTTP na rede local) deixe DJANGO_HTTPS=0.
if os.getenv("DJANGO_HTTPS", "0") == "1":
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 60 * 60 * 24  # um dia: dá para voltar atrás se o domínio mudar
    CSRF_TRUSTED_ORIGINS = [f"https://{h}" for h in ALLOWED_HOSTS if h not in ("*", "localhost", "127.0.0.1")]
    # Atrás de um proxy só, o IP real é o último do X-Forwarded-For que o Caddy acrescenta.
    NINJA_NUM_PROXIES = 1

# Facilitador: uma senha por instalação. Vazia = painel do facilitador desligado.
FACILITADOR_SENHA = os.getenv("FACILITADOR_SENHA", "")
if FACILITADOR_SENHA and len(FACILITADOR_SENHA) < 12:
    raise ImproperlyConfigured("FACILITADOR_SENHA precisa ter pelo menos 12 caracteres.")

# Modelo de chat definido pela equipe: "anthropic", "ollama" ou "demo".
MODEL_PROVIDER = os.getenv("MODEL_PROVIDER", "ollama")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "claude-haiku-5-5" if MODEL_PROVIDER == "anthropic" else "llama3.2:3b")
# Embeddings: "ollama" (bge-m3, multilíngue) ou "local" (sem serviço, só para demonstração).
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "ollama")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "bge-m3")
TOP_K = int(os.getenv("TOP_K", "4"))
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.15" if EMBEDDING_PROVIDER == "local" else "0.5"))
