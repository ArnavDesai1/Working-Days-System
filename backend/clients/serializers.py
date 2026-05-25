from rest_framework import serializers

from .models import Client


class ClientSerializer(serializers.ModelSerializer):
    last_known_updated_at = serializers.DateTimeField(write_only=True, required=False)

    class Meta:
        model = Client
        fields = ["id", "name", "status", "created_at", "updated_at", "last_known_updated_at"]
        read_only_fields = ["created_at", "updated_at"]
