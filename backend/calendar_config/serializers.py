from rest_framework import serializers

from .models import Holiday, WorkingDayConfig


class WorkingDayConfigSerializer(serializers.ModelSerializer):
    last_known_updated_at = serializers.DateTimeField(write_only=True, required=False)

    class Meta:
        model = WorkingDayConfig
        fields = [
            "id",
            "client",
            "year",
            "month",
            "working_days",
            "mon",
            "tue",
            "wed",
            "thu",
            "fri",
            "sat",
            "sun",
            "weekend_policy",
            "updated_at",
            "last_known_updated_at",
        ]
        read_only_fields = ["updated_at"]
        validators = []


class HolidaySerializer(serializers.ModelSerializer):
    last_known_updated_at = serializers.DateTimeField(write_only=True, required=False)

    class Meta:
        model = Holiday
        fields = ["id", "client", "name", "date", "duration_days", "type", "created_by", "updated_at", "last_known_updated_at"]
        read_only_fields = ["created_by", "updated_at"]
