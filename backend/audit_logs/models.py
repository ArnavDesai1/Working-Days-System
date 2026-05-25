from django.db import models


class AuditLog(models.Model):
    actor = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="audit_actions",
    )
    action = models.CharField(max_length=100)
    target_type = models.CharField(max_length=100)
    target_id = models.CharField(max_length=100)
    target_display = models.CharField(max_length=255, blank=True)
    payload = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        actor = self.actor.email if self.actor else "system"
        return f"{actor} {self.action} {self.target_type}:{self.target_display or self.target_id}"
