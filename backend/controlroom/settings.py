"""Django settings for the private For Nooshin room."""

import os
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent.parent


def load_env_file(path: Path):
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


DEBUG = env_bool("DJANGO_DEBUG", False)
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "local-only-change-me")
if not DEBUG and SECRET_KEY == "local-only-change-me":
    raise RuntimeError("DJANGO_SECRET_KEY is required when DJANGO_DEBUG=false")

ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")
    if host.strip()
]
APP_URL = os.getenv("APP_URL", "http://localhost:5174/").rstrip("/")
FRONTEND_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_ORIGINS", APP_URL).split(",")
    if origin.strip()
]

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "room",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "controlroom.middleware.FrontendCorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    # Django only populates request.POST/request.FILES for POST by default.
    # The entry editor uses multipart PATCH for picture replacements.
    "ninja.compatibility.files.fix_request_files_middleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "controlroom.urls"
WSGI_APPLICATION = "controlroom.wsgi.application"
ASGI_APPLICATION = "controlroom.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'db.sqlite3'}")
parsed_database = urlparse(DATABASE_URL)
if parsed_database.scheme in {"postgres", "postgresql"}:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": parsed_database.path.lstrip("/"),
            "USER": parsed_database.username or "",
            "PASSWORD": parsed_database.password or "",
            "HOST": parsed_database.hostname or "",
            "PORT": parsed_database.port or "5432",
            "CONN_MAX_AGE": int(os.getenv("DATABASE_CONN_MAX_AGE", "60")),
            "OPTIONS": {"sslmode": os.getenv("DATABASE_SSLMODE", "require")},
        }
    }
else:
    sqlite_name = parsed_database.path or str(BASE_DIR / "db.sqlite3")
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": sqlite_name}}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 12},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]
PASSWORD_RESET_TIMEOUT = 60 * 60
AUTHENTICATION_BACKENDS = [
    "room.auth_backend.EmailBackend",
]
LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "Asia/Tehran")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = Path(os.getenv("DJANGO_MEDIA_ROOT", str(BASE_DIR / "media")))
MEDIA_URL = "/media/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = env_bool("DJANGO_COOKIE_SECURE", not DEBUG)
SESSION_COOKIE_SAMESITE = os.getenv("DJANGO_COOKIE_SAMESITE", "Lax")
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
CSRF_COOKIE_SAMESITE = os.getenv("DJANGO_CSRF_SAMESITE", SESSION_COOKIE_SAMESITE)
CSRF_COOKIE_HTTPONLY = False
CSRF_TRUSTED_ORIGINS = FRONTEND_ORIGINS
X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "no-referrer"
SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_HSTS_SECONDS", "0" if DEBUG else "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
SECURE_SSL_REDIRECT = env_bool("DJANGO_SSL_REDIRECT", False)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

EMAIL_BACKEND = os.getenv("DJANGO_EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
DEFAULT_FROM_EMAIL = os.getenv("DJANGO_DEFAULT_FROM_EMAIL", "room@localhost")
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "25"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", False)

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID", "")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET", "")
SPOTIFY_REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI", "")
SPOTIFY_REDIRECT_URIS = [
    uri.strip().rstrip("/") + "/"
    for uri in os.getenv("SPOTIFY_REDIRECT_URIS", "").split(",")
    if uri.strip()
]
if not SPOTIFY_REDIRECT_URIS and SPOTIFY_REDIRECT_URI:
    SPOTIFY_REDIRECT_URIS = [SPOTIFY_REDIRECT_URI]
SPOTIFY_TOKEN_KEY = os.getenv("SPOTIFY_TOKEN_KEY", "")
JAMENDO_CLIENT_ID = os.getenv("JAMENDO_CLIENT_ID", "")
IMDB_WATCHLIST_QUERY_HASH = os.getenv("IMDB_WATCHLIST_QUERY_HASH", "")
IMDB_WATCHLIST_ENABLED = env_bool("IMDB_WATCHLIST_ENABLED", True)

DATA_UPLOAD_MAX_MEMORY_SIZE = 60 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 60 * 1024 * 1024
