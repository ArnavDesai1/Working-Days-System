from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("timesheets", "0005_monthlyworkentry_salary_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="clientresource",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True),
            preserve_default=False,
        ),
    ]
