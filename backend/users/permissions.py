from rest_framework.permissions import SAFE_METHODS, BasePermission


class CalendarSetupWritePermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return getattr(user, "role", "") == "admin" or getattr(user, "can_edit_calendar_setup", False)


class EmployeeDeploymentWritePermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return getattr(user, "role", "") == "admin" or getattr(user, "can_edit_employee_deployments", False)
