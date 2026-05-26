from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("clients", "0005_merge_locking_and_updated_at"),
    ]

    operations = [
        migrations.AlterField(
            model_name="client",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
    ]
