from django.contrib.auth import authenticate, get_user_model
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.middleware.csrf import get_token
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.utils import timezone
import os
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from audit_logs.utils import record_audit
from backend.conflicts import conflict_response, is_stale
from .serializers import (
    AdminCreateUserSerializer,
    AdminResetPasswordSerializer,
    AuthUserSerializer,
    ChangePasswordSerializer,
    UserSerializer,
)


def send_temp_password_email(user, temp_password, is_new_account=True):
    frontend_url = os.environ.get("FRONTEND_URL", "http://127.0.0.1:5173")
    subject = "Your Clover Working Days System Account — Temporary Password"
    
    if is_new_account:
        message = (
            f"Hello {user.first_name or 'User'},\n\n"
            f"An approved account has been created for you in the Clover Working Days System.\n\n"
            f"Your temporary password is: {temp_password}\n\n"
            f"Please sign in and update your password immediately at:\n{frontend_url}\n\n"
            f"Best regards,\nClover Working Days System Administration"
        )
    else:
        message = (
            f"Hello {user.first_name or 'User'},\n\n"
            f"Your password for the Clover Working Days System has been reset by an administrator.\n\n"
            f"Your new temporary password is: {temp_password}\n\n"
            f"Please sign in and update your password immediately at:\n{frontend_url}\n\n"
            f"Best regards,\nClover Working Days System Administration"
        )
        
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL or os.environ.get("MAIL_USERNAME"),
        recipient_list=[user.email],
        fail_silently=False,
    )


def password_expiry_datetime(user):
    max_age = getattr(settings, "PASSWORD_MAX_AGE_DAYS", 90)
    return user.password_changed_at + timezone.timedelta(days=max_age)


def password_expires_in_days(user):
    expires_at = password_expiry_datetime(user)
    return max(0, (expires_at.date() - timezone.now().date()).days)


def write_audit(actor, action, target_user, payload=None):
    record_audit(
        actor,
        action,
        "user",
        target_user.id,
        target_user.email,
        payload or {},
    )


def active_admin_count(exclude_user=None):
    queryset = get_user_model().objects.filter(role="admin", is_active=True)
    if exclude_user:
        queryset = queryset.exclude(pk=exclude_user.pk)
    return queryset.count()


def jwt_cookie_settings():
    return {
        "secure": settings.JWT_COOKIE_SECURE,
        "httponly": True,
        "samesite": settings.JWT_COOKIE_SAMESITE,
        "path": "/",
    }


def set_auth_cookies(response, access_token, refresh_token=None):
    response.set_cookie(
        settings.JWT_ACCESS_COOKIE_NAME,
        access_token,
        max_age=int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()),
        **jwt_cookie_settings(),
    )
    if refresh_token:
        response.set_cookie(
            settings.JWT_REFRESH_COOKIE_NAME,
            refresh_token,
            max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
            **jwt_cookie_settings(),
        )
    return response


def clear_auth_cookies(response):
    response.delete_cookie(
        settings.JWT_ACCESS_COOKIE_NAME,
        path="/",
        samesite=settings.JWT_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        path="/",
        samesite=settings.JWT_COOKIE_SAMESITE,
    )
    return response


class EmailTokenObtainPairSerializer(serializers.Serializer):
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email", "").lower().strip()
        password = attrs.get("password")
        user = authenticate(
            request=self.context.get("request"),
            username=email,
            password=password,
        )

        if user is None:
            raise serializers.ValidationError("No active account found with the given credentials.")

        refresh = RefreshToken.for_user(user)
        data = {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }

        data["user"] = AuthUserSerializer(user).data
        data["password_expires_in_days"] = password_expires_in_days(user)
        data["password_expires_at"] = password_expiry_datetime(user).isoformat()
        data["must_reset_password"] = user.must_reset_password or data["password_expires_in_days"] <= 0
        return data


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data.copy()
        access_token = data.pop("access")
        refresh_token = data.pop("refresh")
        csrf_token = get_token(request)
        data["csrf_token"] = csrf_token
        response = Response(data, status=status.HTTP_200_OK)
        return set_auth_cookies(response, access_token, refresh_token)


class CookieTokenRefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME) or request.data.get("refresh")
        if not refresh_token:
            return clear_auth_cookies(Response({"detail": "Refresh token is missing."}, status=status.HTTP_401_UNAUTHORIZED))

        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data.copy()
        access_token = data.pop("access")
        next_refresh_token = data.pop("refresh", None)
        csrf_token = get_token(request)
        response = Response({
            "detail": "Session refreshed.",
            "csrf_token": csrf_token,
        }, status=status.HTTP_200_OK)
        return set_auth_cookies(response, access_token, next_refresh_token)


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        return clear_auth_cookies(Response({"detail": "Signed out."}, status=status.HTTP_200_OK))


class UserViewSet(viewsets.ModelViewSet):
    queryset = get_user_model().objects.all().order_by("username")
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_serializer_class(self):
        if self.action == "create":
            return AdminCreateUserSerializer
        return UserSerializer

    def perform_destroy(self, instance):
        if instance.role == "admin" and active_admin_count(exclude_user=instance) == 0:
            raise serializers.ValidationError("Cannot deactivate the last active admin.")
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        write_audit(
            self.request.user,
            "USER_DEACTIVATED",
            instance,
            {"role": instance.role},
        )

    def perform_create(self, serializer):
        user = serializer.save()
        write_audit(
            self.request.user,
            "USER_CREATED",
            user,
            {"role": user.role, "is_active": user.is_active},
        )
        return user

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        one_time_password = serializer.validated_data["password"]
        user = self.perform_create(serializer)
        
        email_sent = False
        email_error = None
        try:
            send_temp_password_email(user, one_time_password, is_new_account=True)
            email_sent = True
        except Exception as e:
            print(f"Failed to email temp password to {user.email}: {e}")
            email_error = str(e)
            
        payload = UserSerializer(user, context={"request": request}).data
        payload["email_sent"] = email_sent
        if email_error:
            payload["email_error"] = email_error
        if not email_sent:
            payload["one_time_temporary_password"] = one_time_password
            
        headers = self.get_success_headers(payload)
        return Response(payload, status=status.HTTP_201_CREATED, headers=headers)

    def perform_update(self, serializer):
        previous_role = serializer.instance.role
        user = serializer.save()
        write_audit(
            self.request.user,
            "USER_UPDATED",
            user,
            {
                "role": user.role,
                "previous_role": previous_role,
                "calendar_setup_access": user.can_edit_calendar_setup,
                "employee_deployment_access": user.can_edit_employee_deployments,
            },
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if is_stale(instance, request):
            return conflict_response()
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        serializer = AdminResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_password = serializer.validated_data["new_password"]
        user.set_password(new_password)
        user.must_reset_password = serializer.validated_data["must_reset_password"]
        user.password_changed_at = timezone.now()
        permissions_cleared = False
        if serializer.validated_data.get("clear_edit_permissions", True) and user.role != "admin":
            user.can_edit_calendar_setup = False
            user.can_edit_employee_deployments = False
            permissions_cleared = True
        user.save(
            update_fields=[
                "password",
                "must_reset_password",
                "password_changed_at",
                "can_edit_calendar_setup",
                "can_edit_employee_deployments",
            ]
        )
        write_audit(
            request.user,
            "USER_PASSWORD_RESET",
            user,
            {
                "must_reset_password": user.must_reset_password,
                "permissions_cleared": permissions_cleared,
            },
        )
        
        email_sent = False
        email_error = None
        if user.must_reset_password:
            try:
                send_temp_password_email(user, new_password, is_new_account=False)
                email_sent = True
            except Exception as e:
                print(f"Failed to email reset temp password to {user.email}: {e}")
                email_error = str(e)
                
        payload = UserSerializer(user, context={"request": request}).data
        payload["email_sent"] = email_sent
        if email_error:
            payload["email_error"] = email_error
        if user.must_reset_password and not email_sent:
            payload["one_time_temporary_password"] = new_password
            
        return Response(payload)

    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.save(update_fields=["is_active"])
        write_audit(
            request.user,
            "USER_ACTIVATED",
            user,
            {"role": user.role},
        )
        return Response(UserSerializer(user).data)


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "user": AuthUserSerializer(request.user).data,
                "password_expires_in_days": password_expires_in_days(request.user),
                "password_expires_at": password_expiry_datetime(request.user).isoformat(),
                "must_reset_password": request.user.must_reset_password
                or password_expires_in_days(request.user) <= 0,
                "csrf_token": get_token(request),
            }
        )


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        if not request.user.check_password(serializer.validated_data["current_password"]):
            return Response({"detail": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(serializer.validated_data["new_password"])
        request.user.must_reset_password = False
        request.user.password_changed_at = timezone.now()
        request.user.save(update_fields=["password", "must_reset_password", "password_changed_at"])
        write_audit(
            request.user,
            "PASSWORD_CHANGED",
            request.user,
            {"reset_required_cleared": True},
        )
        return Response(
            {
                "detail": "Password changed successfully.",
                "password_expires_in_days": password_expires_in_days(request.user),
                "password_expires_at": password_expiry_datetime(request.user).isoformat(),
                "must_reset_password": False,
            }
        )


class RequestPasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email", "").lower().strip()
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        try:
            user = User.objects.get(email=email, is_active=True)
        except User.DoesNotExist:
            return Response(
                {"detail": "If this email is approved, a reset will be prepared."},
                status=status.HTTP_200_OK,
            )

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        frontend_url = os.environ.get("FRONTEND_URL", "http://127.0.0.1:5173")
        reset_link = f"{frontend_url}/?reset=1&uid={uid}&token={token}"

        try:
            send_mail(
                subject="Reset your Clover Working Days System password",
                message=(
                    "A password reset was requested for your Clover Working Days System account.\n\n"
                    f"Use this link to set a new password:\n{reset_link}\n\n"
                    "If you did not request this, ignore this email."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL or os.environ.get("MAIL_USERNAME"),
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception as exc:
            # Fallback to server logs so that developers/admins can retrieve it directly if SMTP fails
            print(f"PASSWORD RESET LINK FOR {user.email}: {reset_link}")
            return Response(
                {
                    "detail": f"Failed to send email: {str(exc)}. Please confirm your Render/SMTP environment variables (MAIL_USERNAME and MAIL_APP_PASSWORD) are set. Admins can view the reset link in the server logs."
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "detail": "If this email is approved, a password reset link has been sent.",
            }
        )


class ConfirmPasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uid = request.data.get("uid", "")
        token = request.data.get("token", "")
        new_password = request.data.get("new_password", "")

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = get_user_model().objects.get(pk=user_id, is_active=True)
        except Exception:
            return Response({"detail": "Invalid reset link."}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Invalid or expired reset link."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_password, user)
        except Exception as exc:
            return Response({"detail": exc.messages if hasattr(exc, "messages") else str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.must_reset_password = False
        user.password_changed_at = timezone.now()
        user.save(update_fields=["password", "must_reset_password", "password_changed_at"])
        write_audit(
            user,
            "PASSWORD_RESET_CONFIRMED",
            user,
            {"via_reset_link": True},
        )

        return Response({"detail": "Password reset successfully. You can now sign in."})
