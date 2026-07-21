from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('customers', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomerAccount',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('customer', models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name='mobile_account', to='customers.customer')),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='customer_account', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['customer__name'],
            },
        ),
        migrations.AddIndex(
            model_name='customeraccount',
            index=models.Index(fields=['user'], name='customers_c_user_id_856e31_idx'),
        ),
        migrations.AddIndex(
            model_name='customeraccount',
            index=models.Index(fields=['customer'], name='customers_c_custome_03d238_idx'),
        ),
    ]
