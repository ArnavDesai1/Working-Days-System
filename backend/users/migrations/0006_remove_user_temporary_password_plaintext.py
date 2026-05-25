from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0005_user_updated_at"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="user",
            name="temporary_password_plaintext",
        ),
    ]
