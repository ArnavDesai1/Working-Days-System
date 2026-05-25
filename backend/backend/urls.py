"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from calendar_config.views import CalendarExcelExtractView, CalendarExcelPreviewView, HolidayViewSet, WorkingDayConfigViewSet
from clients.views import ClientViewSet
from audit_logs.views import AuditLogViewSet
from timesheets.views import (
    HolidayRecommendationView,
    MailTableFetchView,
    PmoTimesheetDataViewSet,
    TimesheetViewSet,
)
from users.views import (
    ChangePasswordView,
    ConfirmPasswordResetView,
    CookieTokenRefreshView,
    CurrentUserView,
    EmailTokenObtainPairView,
    LogoutView,
    RequestPasswordResetView,
    UserViewSet,
)

router = DefaultRouter()
router.register("audit-logs", AuditLogViewSet, basename="audit-log")
router.register("users", UserViewSet, basename="user")
router.register("clients", ClientViewSet, basename="client")
router.register("working-day-configs", WorkingDayConfigViewSet, basename="working-day-config")
router.register("holidays", HolidayViewSet, basename="holiday")
router.register("timesheets", TimesheetViewSet, basename="timesheet")
router.register("pmo-timesheets", PmoTimesheetDataViewSet, basename="pmo-timesheet")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),

    path("api/mail-intake/fetch/", MailTableFetchView.as_view(), name="mail_table_fetch"),
    path("api/holiday-recommendations/", HolidayRecommendationView.as_view(), name="holiday_recommendations"),
    path("api/calendar-excel/preview/", CalendarExcelPreviewView.as_view(), name="calendar_excel_preview"),
    path("api/calendar-excel/extract/", CalendarExcelExtractView.as_view(), name="calendar_excel_extract"),
    path("api/auth/token/", EmailTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", CookieTokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/logout/", LogoutView.as_view(), name="logout"),
    path("api/auth/me/", CurrentUserView.as_view(), name="current_user"),
    path("api/auth/change-password/", ChangePasswordView.as_view(), name="change_password"),
    path("api/auth/request-password-reset/", RequestPasswordResetView.as_view(), name="request_password_reset"),
    path("api/auth/confirm-password-reset/", ConfirmPasswordResetView.as_view(), name="confirm_password_reset"),
]
