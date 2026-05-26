from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("calendar_config", "0006_workingdayconfig_updated_at"),
    ]

    operations = [
        migrations.AlterField(
            model_name="workingdayconfig",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
    ]
