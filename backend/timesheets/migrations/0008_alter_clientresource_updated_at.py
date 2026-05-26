from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("timesheets", "0007_add_locking_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="clientresource",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
    ]
