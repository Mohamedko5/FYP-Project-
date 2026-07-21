import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import UserProfile
from customers.models import Customer, CustomerAccount


class Command(BaseCommand):
    help = 'Create or repair a local development Customer mobile account.'

    def handle(self, *args, **options):
        email = os.environ.get('BAYAD_CUSTOMER_EMAIL', 'customer@bayad.com').strip().lower()
        password = os.environ.get('BAYAD_CUSTOMER_PASSWORD', '').strip()
        if not password:
            raise CommandError('Set BAYAD_CUSTOMER_PASSWORD before running this command.')

        User = get_user_model()
        with transaction.atomic():
            admin_user = User.objects.filter(is_superuser=True).first() or User.objects.filter(is_staff=True).first()
            if not admin_user:
                admin_user = User.objects.create_user(
                    username='mobile_customer_seed_admin',
                    email='mobile-seed-admin@bayad.local',
                    password=None,
                    is_staff=True,
                    is_superuser=True,
                )
                UserProfile.objects.update_or_create(user=admin_user, defaults={'role': UserProfile.ROLE_ADMIN})

            customer, customer_created = Customer.objects.get_or_create(
                phone='+249000000001',
                defaults={
                    'name': 'Bayad Development Customer',
                    'secondary_phone': '',
                    'address': 'Sudan',
                    'customer_type': Customer.TYPE_EXPORTER,
                    'is_active': True,
                    'is_deleted': False,
                    'created_by': admin_user,
                    'updated_by': admin_user,
                },
            )
            if not customer_created:
                customer.is_active = True
                customer.is_deleted = False
                customer.updated_by = admin_user
                customer.save(update_fields=['is_active', 'is_deleted', 'updated_by', 'updated_at'])

            base_username = email.split('@')[0]
            user = User.objects.filter(email__iexact=email).first()
            if user is None:
                username = base_username
                suffix = 1
                while User.objects.filter(username__iexact=username).exists():
                    suffix += 1
                    username = f'{base_username}{suffix}'
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=None,
                    is_active=True,
                    is_staff=False,
                    is_superuser=False,
                )

            user.email = email
            user.is_active = True
            user.is_staff = False
            user.is_superuser = False
            user.set_password(password)
            user.save(update_fields=['email', 'password', 'is_active', 'is_staff', 'is_superuser'])
            UserProfile.objects.filter(user=user).delete()
            CustomerAccount.objects.update_or_create(user=user, defaults={'customer': customer})

        self.stdout.write(self.style.SUCCESS(f'Mobile customer account ready for {email} linked to {customer.code}.'))
