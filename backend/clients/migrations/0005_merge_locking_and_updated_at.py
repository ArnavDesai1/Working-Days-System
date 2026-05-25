from django.db import migrations


class Migration(migrations.Migration):
    """Unite parallel branches: 0002 (locking) and 0004 (updated_at) both depended on 0001."""

    dependencies = [
        ("clients", "0002_add_locking_fields"),
        ("clients", "0004_client_updated_at"),
    ]

    operations = []
