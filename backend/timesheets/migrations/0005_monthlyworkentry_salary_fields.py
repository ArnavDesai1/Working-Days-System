from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("timesheets", "0004_seed_calendar_initial_data"),
    ]

    operations = [
        migrations.AddField(
            model_name="monthlyworkentry",
            name="payable_salary",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name="monthlyworkentry",
            name="total_salary",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
    ]
