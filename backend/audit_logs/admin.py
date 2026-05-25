from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor", "action", "target_type", "target_display")
    list_filter = ("action", "target_type", "created_at")
    search_fields = ("actor__email", "target_display", "target_id", "action")
    readonly_fields = ("created_at",)
