from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from accounts.models import UserProfile


class Command(BaseCommand):
    help = 'Create the default Bayad admin account for local development.'

    def handle(self, *args, **options):
        User = get_user_model()
        user, created = User.objects.get_or_create(
            email='admin@bayad.com',
            defaults={'username': 'admin'},
        )

        if created:
            user.set_password('admin123')
            user.is_staff = True
            user.is_superuser = True
            user.save()
            self.stdout.write(self.style.SUCCESS('Created default admin: admin@bayad.com / admin123'))
        else:
            self.stdout.write(self.style.WARNING('Default admin already exists. Password was not changed.'))

        UserProfile.objects.update_or_create(user=user, defaults={'role': UserProfile.ROLE_ADMIN})
