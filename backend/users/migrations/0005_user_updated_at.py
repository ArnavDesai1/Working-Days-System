from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0004_user_permissions_and_temp_password"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True),
            preserve_default=False,
        ),
    ]
