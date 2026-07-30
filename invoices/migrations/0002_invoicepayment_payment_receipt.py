from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoicepayment',
            name='payment_receipt',
            field=models.FileField(blank=True, null=True, upload_to='invoice_payments/receipts/'),
        ),
    ]
