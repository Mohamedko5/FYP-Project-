from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Validate Bayad email backend configuration without exposing credentials.'

    def handle(self, *args, **options):
        backend = settings.EMAIL_BACKEND
        self.stdout.write(f'EMAIL_BACKEND: {backend}')

        if backend == 'django.core.mail.backends.console.EmailBackend':
            self.stdout.write(self.style.WARNING('Console email mode is active. Emails will appear in the Django terminal.'))
            return

        if backend != 'django.core.mail.backends.smtp.EmailBackend':
            self.stdout.write(self.style.WARNING('Email backend is not Django SMTP or console backend.'))

        missing = []
        for name in ('EMAIL_HOST', 'EMAIL_HOST_USER', 'EMAIL_HOST_PASSWORD', 'DEFAULT_FROM_EMAIL'):
            if not getattr(settings, name, None):
                missing.append(name)
        if not isinstance(settings.EMAIL_PORT, int) or settings.EMAIL_PORT <= 0:
            missing.append('EMAIL_PORT')
        if settings.EMAIL_USE_TLS and settings.EMAIL_USE_SSL:
            missing.append('EMAIL_USE_TLS/EMAIL_USE_SSL cannot both be true')

        self.stdout.write(f'EMAIL_HOST: {"configured" if settings.EMAIL_HOST else "missing"}')
        self.stdout.write(f'EMAIL_PORT: {settings.EMAIL_PORT}')
        self.stdout.write(f'EMAIL_HOST_USER: {"configured" if settings.EMAIL_HOST_USER else "missing"}')
        self.stdout.write(f'EMAIL_HOST_PASSWORD: {"configured" if settings.EMAIL_HOST_PASSWORD else "missing"}')
        self.stdout.write(f'DEFAULT_FROM_EMAIL: {"configured" if settings.DEFAULT_FROM_EMAIL else "missing"}')
        self.stdout.write(f'EMAIL_USE_TLS: {settings.EMAIL_USE_TLS}')
        self.stdout.write(f'EMAIL_USE_SSL: {settings.EMAIL_USE_SSL}')

        if missing:
            self.stdout.write(self.style.WARNING('Missing or invalid SMTP setting(s): ' + ', '.join(missing)))
            return

        self.stdout.write(self.style.SUCCESS('SMTP email configuration looks complete. Run sendtestemail to verify real delivery.'))
