from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("calendar_config", "0005_holiday_unique_client_date_name"),
    ]

    operations = [
        migrations.AddField(
            model_name="workingdayconfig",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True),
            preserve_default=False,
        ),
    ]
