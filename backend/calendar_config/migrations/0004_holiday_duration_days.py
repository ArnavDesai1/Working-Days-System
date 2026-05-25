from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("calendar_config", "0003_workingdayconfig_month_workingdayconfig_working_days_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="holiday",
            name="duration_days",
            field=models.PositiveIntegerField(default=1),
        ),
    ]
