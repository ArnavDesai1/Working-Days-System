from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("calendar_config", "0004_holiday_duration_days"),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name="holiday",
            unique_together={("client", "date", "name")},
        ),
    ]
