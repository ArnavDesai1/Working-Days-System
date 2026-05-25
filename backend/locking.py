from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response


def acquire_lock(obj, user):
    """
    Acquire a lock on a model instance for a specific user.
    Returns tuple (success: bool, message: str, lock_data: dict)
    """
    # Check if already locked by another user
    if obj.locked_by and obj.locked_by != user:
        return False, f"Locked by {obj.locked_by.username}", {
            'locked_by': obj.locked_by.username,
            'locked_at': obj.locked_at.isoformat() if obj.locked_at else None,
        }

    # Acquire or renew lock
    obj.locked_by = user
    obj.locked_at = timezone.now()
    obj.lock_expires_at = None  # No auto-expiry, released on save/cancel
    obj.save()

    return True, "Lock acquired", {
        'locked_by': obj.locked_by.username,
        'locked_at': obj.locked_at.isoformat(),
    }


def release_lock(obj, user=None):
    """
    Release a lock on a model instance.
    If user is provided, verify they own the lock before releasing.
    Returns tuple (success: bool, message: str)
    """
    if not obj.locked_by:
        return True, "Not locked"

    if user and obj.locked_by != user:
        return False, f"Lock owned by {obj.locked_by.username}"

    obj.locked_by = None
    obj.locked_at = None
    obj.lock_expires_at = None
    obj.save()

    return True, "Lock released"


def is_locked(obj):
    """Check if object is currently locked by someone."""
    return bool(obj.locked_by)


def validate_lock_owner(obj, user):
    """
    Validate that user owns the lock on object.
    Returns tuple (is_valid: bool, error_response: Response or None)
    """
    if not obj.locked_by:
        return False, Response(
            {'error': 'Resource not locked. Acquire lock before editing.'},
            status=status.HTTP_423_LOCKED
        )

    if obj.locked_by != user:
        return False, Response(
            {
                'error': f'Resource locked by {obj.locked_by.username}',
                'locked_by': obj.locked_by.username,
                'locked_at': obj.locked_at.isoformat(),
            },
            status=status.HTTP_423_LOCKED
        )

    return True, None


def get_lock_status(obj):
    """Get current lock status of an object."""
    if not obj.locked_by:
        return {
            'is_locked': False,
            'locked_by': None,
            'locked_at': None,
        }

    return {
        'is_locked': True,
        'locked_by': obj.locked_by.username,
        'locked_at': obj.locked_at.isoformat() if obj.locked_at else None,
    }

