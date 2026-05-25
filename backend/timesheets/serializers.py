from rest_framework import serializers

from .models import ClientResource, MonthlyWorkEntry, PmoTimesheetData, Timesheet


class ClientResourceSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    locked_by_username = serializers.CharField(source="locked_by.username", read_only=True)
    last_known_updated_at = serializers.DateTimeField(write_only=True, required=False)

    class Meta:
        model = ClientResource
        fields = [
            "id",
            "client",
            "client_name",
            "employee_code",
            "full_name",
            "email",
            "designation",
            "status",
            "created_at",
            "updated_at",
            "locked_by",
            "locked_by_username",
            "locked_at",
            "lock_expires_at",
            "last_known_updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "locked_by", "locked_at", "lock_expires_at"]


class MonthlyWorkEntrySerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    resource_name = serializers.CharField(source="resource.full_name", read_only=True)
    employee_code = serializers.CharField(source="resource.employee_code", read_only=True)
    locked_by_username = serializers.CharField(source="locked_by.username", read_only=True)
    last_known_updated_at = serializers.DateTimeField(write_only=True, required=False)

    class Meta:
        model = MonthlyWorkEntry
        fields = [
            "id",
            "client",
            "client_name",
            "resource",
            "resource_name",
            "employee_code",
            "year",
            "month",
            "expected_working_days",
            "days_worked",
            "leave_days",
            "extra_days",
            "total_salary",
            "payable_salary",
            "remarks",
            "status",
            "submitted_by",
            "updated_at",
            "locked_by",
            "locked_by_username",
            "locked_at",
            "lock_expires_at",
            "last_known_updated_at",
        ]
        read_only_fields = ["submitted_by", "updated_at", "locked_by", "locked_at", "lock_expires_at"]


class TimesheetSerializer(serializers.ModelSerializer):
    locked_by_username = serializers.CharField(source="locked_by.username", read_only=True)

    class Meta:
        model = Timesheet
        fields = [
            "id",
            "client",
            "billing_period",
            "reported_days",
            "expected_days",
            "day_variance",
            "status",
            "submitted_by",
            "submitted_at",
            "locked_by",
            "locked_by_username",
            "locked_at",
            "lock_expires_at",
        ]
        read_only_fields = ["submitted_by", "submitted_at", "locked_by", "locked_at", "lock_expires_at"]


class PmoTimesheetDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = PmoTimesheetData
        fields = [
            "id",
            "client_name",
            "employee_code",
            "employee_name",
            "primary_skill",
            "po_number",
            "start_date",
            "end_date",
            "timesheet_month",
            "timesheet_year",
            "billing_rate",
            "leaves_taken",
            "dates_of_leaves",
            "compoff_days",
            "compoff_dates",
            "total_leave",
            "pmo_billed_amount",
            "source_file",
            "uploaded_at",
            "status",
        ]
