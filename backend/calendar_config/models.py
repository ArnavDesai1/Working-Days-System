from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from clients.models import Client
from users.models import User

class WorkingDayConfig(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE)
    year = models.IntegerField(default=2026, validators=[MinValueValidator(1900), MaxValueValidator(2100)])
    month = models.IntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(12)])
    working_days = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(366)])

    mon = models.BooleanField(default=True)
    tue = models.BooleanField(default=True)
    wed = models.BooleanField(default=True)
    thu = models.BooleanField(default=True)
    fri = models.BooleanField(default=True)
    sat = models.BooleanField(default=False)
    sun = models.BooleanField(default=False)

    weekend_policy = models.CharField(
        max_length=10,
        choices=[('paid', 'Paid'), ('unpaid', 'Unpaid')],
        default='unpaid',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('client', 'year', 'month')

class Holiday(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    date = models.DateField()
    duration_days = models.PositiveIntegerField(default=1, validators=[MaxValueValidator(365)])

    type = models.CharField(
        max_length=10,
        choices=[('public', 'Public'), ('company', 'Company')]
    )

    class Meta:
        unique_together = ('client', 'date', 'name')

    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    updated_at = models.DateTimeField(auto_now=True)
