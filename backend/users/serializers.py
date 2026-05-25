from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers


class AuthUserSerializer(serializers.ModelSerializer):
    """Minimal user profile for login/session — never includes secrets or password hashes."""

    class Meta:
        model = get_user_model()
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_active",
            "must_reset_password",
            "can_edit_calendar_setup",
            "can_edit_employee_deployments",
        ]
        read_only_fields = fields


class UserSerializer(serializers.ModelSerializer):
    last_known_updated_at = serializers.DateTimeField(write_only=True, required=False)

    class Meta:
        model = get_user_model()
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_active",
            "must_reset_password",
            "password_changed_at",
            "can_edit_calendar_setup",
            "can_edit_employee_deployments",
            "updated_at",
            "last_known_updated_at",
        ]
        read_only_fields = ["username", "password_changed_at", "updated_at"]

    def validate_email(self, value):
        email = value.lower().strip()
        queryset = get_user_model().objects.filter(email=email)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if instance.role == "admin":
            instance.is_staff = True
            instance.is_superuser = True
        else:
            instance.is_staff = False
            instance.is_superuser = False
        instance.save()
        return instance


class AdminCreateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = get_user_model()
        fields = [
            "email",
            "first_name",
            "last_name",
            "role",
            "password",
            "can_edit_calendar_setup",
            "can_edit_employee_deployments",
        ]

    def validate_email(self, value):
        email = value.lower().strip()
        if get_user_model().objects.filter(email=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        email = validated_data["email"]
        user = get_user_model()(username=email, **validated_data)
        if user.role == "admin":
            user.is_staff = True
            user.is_superuser = True
            user.can_edit_calendar_setup = True
            user.can_edit_employee_deployments = True
        user.set_password(password)
        user.must_reset_password = True
        user.password_changed_at = timezone.now()
        user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value, self.context["request"].user)
        return value


class AdminResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True)
    must_reset_password = serializers.BooleanField(default=True)
    clear_edit_permissions = serializers.BooleanField(default=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value
