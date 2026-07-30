from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('daily_journal', '0008_dailyopeningbalance'),
    ]

    operations = [
        migrations.AlterField(
            model_name='journaltransaction',
            name='warehouse_operation',
            field=models.CharField(
                blank=True,
                choices=[
                    ('stock_in', 'Add Stock'),
                    ('manual_withdrawal', 'Manual Withdrawal'),
                    ('shipment_out', 'Shipment Withdrawal'),
                ],
                max_length=30,
                null=True,
            ),
        ),
    ]
