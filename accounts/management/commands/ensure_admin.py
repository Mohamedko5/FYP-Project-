import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from accounts.models import UserProfile


class Command(BaseCommand):
    help = 'Create or repair the local development Bayad admin account.'

    def handle(self, *args, **options):
        password = os.environ.get('BAYAD_ADMIN_PASSWORD')
        if not password:
            raise CommandError('Set BAYAD_ADMIN_PASSWORD before running this command.')

        User = get_user_model()
        email = 'admin@bayad.com'
        username = 'admin'

        users = list(User.objects.filter(email__iexact=email).order_by('id'))
        if users:
            user = users[0]
            if getattr(user, 'username', '') != username and not User.objects.filter(username=username).exclude(id=user.id).exists():
                user.username = username
        else:
            user = User.objects.create_user(username=username, email=email)

        user.email = email
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.set_password(password)
        user.save()

        UserProfile.objects.update_or_create(user=user, defaults={'role': UserProfile.ROLE_ADMIN})

        if len(users) > 1:
            self.stdout.write(self.style.WARNING(f'Found {len(users)} users with {email}; repaired user id {user.id} only.'))

        self.stdout.write(self.style.SUCCESS(f'Ensured local development admin account: {email} ({username})'))
