from rest_framework import viewsets, permissions

from audit_logs.utils import record_audit
from backend.conflicts import conflict_response, is_stale
from .models import Client
from .serializers import ClientSerializer


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all().order_by("name")
    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        client = serializer.save()
        record_audit(
            self.request.user,
            "CLIENT_CREATED",
            "client",
            client.id,
            client.name,
            {"status": client.status},
        )

    def perform_update(self, serializer):
        previous_name = serializer.instance.name
        previous_status = serializer.instance.status
        client = serializer.save()
        record_audit(
            self.request.user,
            "CLIENT_UPDATED",
            "client",
            client.id,
            client.name,
            {
                "name": client.name,
                "status": client.status,
                "previous_name": previous_name,
                "previous_status": previous_status,
            },
        )

    def perform_destroy(self, instance):
        record_audit(
            self.request.user,
            "CLIENT_DELETED",
            "client",
            instance.id,
            instance.name,
            {"status": instance.status},
        )
        instance.delete()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if is_stale(instance, request):
            return conflict_response()
        return super().update(request, *args, **kwargs)
