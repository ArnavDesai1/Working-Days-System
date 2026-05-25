from django.db import migrations


def seed_initial_data(apps, schema_editor):
    Client = apps.get_model("clients", "Client")
    WorkingDayConfig = apps.get_model("calendar_config", "WorkingDayConfig")
    Holiday = apps.get_model("calendar_config", "Holiday")
    User = apps.get_model("users", "User")
    ClientResource = apps.get_model("timesheets", "ClientResource")
    MonthlyWorkEntry = apps.get_model("timesheets", "MonthlyWorkEntry")

    actor = User.objects.order_by("id").first()
    if not actor:
        return

    hdb, _ = Client.objects.get_or_create(name="HDB Financial Services", defaults={"status": "active"})
    clover, _ = Client.objects.get_or_create(name="Clover Internal Services", defaults={"status": "active"})

    WorkingDayConfig.objects.get_or_create(
        client=hdb,
        year=2026,
        month=5,
        defaults={
            "working_days": 21,
            "mon": True,
            "tue": True,
            "wed": True,
            "thu": True,
            "fri": True,
            "sat": False,
            "sun": False,
            "weekend_policy": "unpaid",
        },
    )
    WorkingDayConfig.objects.get_or_create(
        client=clover,
        year=2026,
        month=6,
        defaults={
            "working_days": 22,
            "mon": True,
            "tue": True,
            "wed": True,
            "thu": True,
            "fri": True,
            "sat": False,
            "sun": False,
            "weekend_policy": "unpaid",
        },
    )

    for client, name, holiday_date, holiday_type in [
        (hdb, "Maharashtra Day", "2026-05-01", "public"),
        (hdb, "Client Foundation Day", "2026-05-18", "company"),
        (clover, "Team Offsite Day", "2026-06-12", "company"),
    ]:
        Holiday.objects.get_or_create(
            client=client,
            date=holiday_date,
            defaults={"name": name, "type": holiday_type, "created_by": actor},
        )

    resources = [
        (hdb, "CI16023", "Arnav Desai", "arnav.desai@somaiya.edu", "Associate Consultant"),
        (hdb, "CI8670", "Riya Shah", "riya.shah@example.com", "QA Analyst"),
        (clover, "CL1021", "Neel Mehta", "neel.mehta@example.com", "Developer"),
    ]
    created_resources = {}
    for client, code, name, email, designation in resources:
        resource, _ = ClientResource.objects.get_or_create(
            client=client,
            employee_code=code,
            defaults={
                "full_name": name,
                "email": email,
                "designation": designation,
                "status": "active",
            },
        )
        created_resources[code] = resource

    entries = [
        (hdb, "CI16023", 2026, 5, 21, "21.00", "0.00", "0.00", "Full month worked"),
        (hdb, "CI8670", 2026, 5, 21, "19.00", "2.00", "0.00", "Two approved leave days"),
        (clover, "CL1021", 2026, 6, 22, "22.00", "0.00", "1.00", "One extra support day"),
    ]
    for client, code, year, month, expected, worked, leaves, extra, remarks in entries:
        MonthlyWorkEntry.objects.get_or_create(
            resource=created_resources[code],
            year=year,
            month=month,
            defaults={
                "client": client,
                "expected_working_days": expected,
                "days_worked": worked,
                "leave_days": leaves,
                "extra_days": extra,
                "remarks": remarks,
                "status": "draft",
                "submitted_by": actor,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ("calendar_config", "0003_workingdayconfig_month_workingdayconfig_working_days_and_more"),
        ("clients", "0001_initial"),
        ("timesheets", "0003_fileuploadlog_pmotimesheetdata_clientresource_and_more"),
        ("users", "0003_alter_user_email"),
    ]

    operations = [
        migrations.RunPython(seed_initial_data, migrations.RunPython.noop),
    ]
