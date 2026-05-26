from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0006_remove_user_temporary_password_plaintext"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
    ]
