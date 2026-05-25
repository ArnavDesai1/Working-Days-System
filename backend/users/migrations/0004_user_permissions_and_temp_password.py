from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0003_alter_user_email"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="can_edit_calendar_setup",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="user",
            name="can_edit_employee_deployments",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="user",
            name="temporary_password_plaintext",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
