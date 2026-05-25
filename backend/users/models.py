from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('user', 'User'),
    ]
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')
    password_changed_at = models.DateTimeField(default=timezone.now)
    must_reset_password = models.BooleanField(default=False)
    can_edit_calendar_setup = models.BooleanField(default=False)
    can_edit_employee_deployments = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.email:
            self.username = self.email
        super().save(*args, **kwargs)
