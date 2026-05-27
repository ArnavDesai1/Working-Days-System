import os
import django
from django.db import connection

def drop_tables():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
    django.setup()

    tables = [
        "timesheets_timesheet",
        "timesheets_monthlyworkentry",
        "timesheets_clientresource",
        "pmo_timesheet_data",
        "file_upload_log",
    ]

    print("Starting cleanup of timesheets database tables...")
    with connection.cursor() as cursor:
        if connection.vendor == 'sqlite':
            cursor.execute("PRAGMA foreign_keys = OFF;")
        for table in tables:
            try:
                # CASCADE is supported in Postgres. For SQLite, it is ignored or throws, so we catch errors.
                if connection.vendor == 'postgresql':
                    cursor.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")
                else:
                    cursor.execute(f"DROP TABLE IF EXISTS {table};")
                print(f"  [OK] Dropped table: {table}")
            except Exception as e:
                print(f"  [ERROR] Failed to drop {table}: {e}")

        # Delete timesheets migrations history
        try:
            cursor.execute("DELETE FROM django_migrations WHERE app = 'timesheets';")
            print(f"  [OK] Cleared timesheets records from django_migrations table.")
        except Exception as e:
            print(f"  [ERROR] Failed to clear migration history: {e}")

    print("Database cleanup completed successfully.")

if __name__ == "__main__":
    drop_tables()
