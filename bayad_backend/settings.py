import logging
import os
import sys
from pathlib import Path

from corsheaders.defaults import default_headers
BASE_DIR = Path(__file__).resolve().parent.parent
logger = logging.getLogger(__name__)


def load_dotenv(path):
    if not path.exists():
        return
    for line in path.read_text(encoding='utf-8').splitlines():
        value = line.strip()
        if not value or value.startswith('#') or '=' not in value:
            continue
        key, raw = value.split('=', 1)
        key = key.strip()
        raw = raw.strip().strip('"').strip("'")
        os.environ.setdefault(key, raw)


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ('1', 'true', 'yes', 'on')


def env_int(name, default):
    value = os.environ.get(name)
    if value in (None, ''):
        return default
    return int(value)


def env_int_any(names, default):
    for name in names:
        value = os.environ.get(name)
        if value not in (None, ''):
            return int(value)
    return default


load_dotenv(BASE_DIR / '.env')

SECRET_KEY = 'django-insecure-bayad-dev-secret-key-change-before-production'

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '10.0.2.2']


INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'accounts',
    'daily_journal',
    'inventory',
    'customers',
    'workers',
    'orders',
    'invoices',
    'shipments',
    'reports',
    'communications',
    'supply_offers',
    'zakat',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'bayad_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'bayad_backend.wsgi.application'


DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
        'OPTIONS': {
            'timeout': 20,
        },
    }
}


AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Asia/Kuala_Lumpur'

USE_I18N = True

USE_TZ = True

STATIC_URL = 'static/'
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

FRONTEND_URL = 'http://localhost:5173'
PASSWORD_RESET_TIMEOUT = 3600

EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
if 'test' in sys.argv:
    EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
EMAIL_HOST = os.environ.get('EMAIL_HOST', '')
EMAIL_PORT = env_int('EMAIL_PORT', 587)
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = env_bool('EMAIL_USE_TLS', True)
EMAIL_USE_SSL = env_bool('EMAIL_USE_SSL', False)
EMAIL_TIMEOUT = env_int('EMAIL_TIMEOUT', 20)
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER or 'Bayad Company <no-reply@localhost>')
SERVER_EMAIL = DEFAULT_FROM_EMAIL
if EMAIL_USE_TLS and EMAIL_USE_SSL:
    logger.error('Email configuration error: EMAIL_USE_TLS and EMAIL_USE_SSL cannot both be true.')

SMTP_EMAIL_REQUIRED_SETTINGS = {
    'EMAIL_HOST': EMAIL_HOST,
    'EMAIL_HOST_USER': EMAIL_HOST_USER,
    'EMAIL_HOST_PASSWORD': EMAIL_HOST_PASSWORD,
    'DEFAULT_FROM_EMAIL': DEFAULT_FROM_EMAIL,
}
SMTP_EMAIL_MISSING_SETTINGS = [
    name for name, value in SMTP_EMAIL_REQUIRED_SETTINGS.items() if not value
]
SMTP_EMAIL_CONFIG_COMPLETE = (
    EMAIL_BACKEND != 'django.core.mail.backends.smtp.EmailBackend'
    or (not SMTP_EMAIL_MISSING_SETTINGS and not (EMAIL_USE_TLS and EMAIL_USE_SSL))
)
if EMAIL_BACKEND == 'django.core.mail.backends.smtp.EmailBackend' and SMTP_EMAIL_MISSING_SETTINGS and 'test' not in sys.argv:
    logger.error(
        'SMTP email backend is enabled but required setting(s) are missing: %s',
        ', '.join(SMTP_EMAIL_MISSING_SETTINGS),
    )

CUSTOMER_EMAIL_VERIFICATION_EXPIRY_MINUTES = env_int_any(
    ('EMAIL_VERIFICATION_EXPIRY_MINUTES', 'CUSTOMER_EMAIL_VERIFICATION_EXPIRY_MINUTES'),
    10,
)
CUSTOMER_EMAIL_VERIFICATION_MAX_ATTEMPTS = env_int_any(
    ('EMAIL_VERIFICATION_MAX_ATTEMPTS', 'CUSTOMER_EMAIL_VERIFICATION_MAX_ATTEMPTS'),
    5,
)
CUSTOMER_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = env_int_any(
    ('EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS', 'CUSTOMER_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS'),
    60,
)
CUSTOMER_EMAIL_VERIFICATION_MAX_RESENDS = env_int('CUSTOMER_EMAIL_VERIFICATION_MAX_RESENDS', 5)


CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
]

CORS_ALLOW_HEADERS = list(default_headers) + [
    'idempotency-key',
]

CSRF_TRUSTED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/minute',
        'user': '120/minute',
    },
}
