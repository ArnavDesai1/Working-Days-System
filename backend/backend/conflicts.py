from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.response import Response


CONFLICT_MESSAGE = "This record was updated by someone else while you were editing. Please refresh and review the latest version before saving again."


def parse_client_timestamp(value):
    if not value:
        return None
    parsed = parse_datetime(value)
    if parsed is None and isinstance(value, str) and value.endswith("Z"):
        parsed = parse_datetime(value.replace("Z", "+00:00"))
    return parsed


def is_stale(instance, request, field_name="last_known_updated_at"):
    expected = parse_client_timestamp(request.data.get(field_name))
    if expected is None:
        return False
    current = getattr(instance, "updated_at", None)
    if current is None:
        return False
    return current != expected


def conflict_response(message=CONFLICT_MESSAGE):
    return Response({"detail": message}, status=status.HTTP_409_CONFLICT)
