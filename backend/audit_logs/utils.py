from audit_logs.models import AuditLog


def record_audit(actor, action, target_type, target_id, target_display="", payload=None):
    AuditLog.objects.create(
        actor=actor if actor and getattr(actor, "is_authenticated", False) else None,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        target_display=target_display or "",
        payload=payload or {},
    )
