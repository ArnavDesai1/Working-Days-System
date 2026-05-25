from rest_framework import serializers

from .models import AuditLog


ACTION_LABELS = {
    "USER_CREATED": "User created",
    "USER_UPDATED": "User updated",
    "USER_DEACTIVATED": "User deactivated",
    "USER_ACTIVATED": "User activated",
    "USER_PASSWORD_RESET": "Temporary password reset",
    "USER_DELETED": "User deleted",
    "PASSWORD_CHANGED": "Password changed",
    "PASSWORD_RESET_CONFIRMED": "Password reset completed",
    "CLIENT_CREATED": "Client created",
    "CLIENT_UPDATED": "Client updated",
    "CLIENT_DELETED": "Client deleted",
    "CALENDAR_RULES_CREATED": "Calendar rules created",
    "CALENDAR_RULES_UPDATED": "Calendar rules updated",
    "HOLIDAY_CREATED": "Holiday created",
    "HOLIDAY_UPDATED": "Holiday updated",
    "HOLIDAY_DELETED": "Holiday deleted",
    "EMPLOYEE_CREATED": "Employee created",
    "EMPLOYEE_UPDATED": "Employee updated",
    "EMPLOYEE_DELETED": "Employee deleted",
    "MONTHLY_ENTRY_CREATED": "Monthly work entry created",
    "MONTHLY_ENTRY_UPDATED": "Monthly work entry updated",
    "MONTHLY_ENTRY_DELETED": "Monthly work entry deleted",
}


def titleize(value):
    return str(value).replace("_", " ").strip().title()


def stringify(value):
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if value is None or value == "":
        return "Not recorded"
    return str(value)


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.SerializerMethodField()
    action_label = serializers.SerializerMethodField()
    detail_lines = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor_email",
            "action",
            "action_label",
            "target_type",
            "target_id",
            "target_display",
            "payload",
            "detail_lines",
            "created_at",
        ]

    def get_actor_email(self, obj):
        return obj.actor.email if obj.actor else "system"

    def get_action_label(self, obj):
        return ACTION_LABELS.get(obj.action, titleize(obj.action))

    def get_detail_lines(self, obj):
        payload = obj.payload or {}
        lines = []
        for key, value in payload.items():
            if key == "previous_values" and isinstance(value, dict):
                summary = ", ".join(f"{titleize(sub_key)}: {stringify(sub_value)}" for sub_key, sub_value in value.items())
                if summary:
                    lines.append(f"Previous values: {summary}")
                continue
            if isinstance(value, dict):
                summary = ", ".join(f"{titleize(sub_key)}: {stringify(sub_value)}" for sub_key, sub_value in value.items())
                if summary:
                    lines.append(f"{titleize(key)}: {summary}")
                continue
            lines.append(f"{titleize(key)}: {stringify(value)}")
        return lines
