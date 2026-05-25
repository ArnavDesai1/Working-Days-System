from django.db import models
from django.utils import timezone
from datetime import timedelta
from clients.models import Client
from users.models import User

class Timesheet(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('matched', 'Matched'),
        ('mismatched', 'Mismatched'),
    ]

    client = models.ForeignKey(Client, on_delete=models.CASCADE)
    billing_period = models.DateField()

    reported_days = models.IntegerField()
    expected_days = models.IntegerField()
    day_variance = models.IntegerField()

    status = models.CharField(max_length=20, choices=STATUS_CHOICES)

    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE)
    submitted_at = models.DateTimeField(auto_now_add=True)

    # Pessimistic locking fields
    locked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='locked_timesheets')
    locked_at = models.DateTimeField(null=True, blank=True)
    lock_expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('client', 'billing_period')


class ClientResource(models.Model):
    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive"),
    ]

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="resources")
    employee_code = models.CharField(max_length=80)
    full_name = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    designation = models.CharField(max_length=160, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Pessimistic locking fields
    locked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='locked_resources')
    locked_at = models.DateTimeField(null=True, blank=True)
    lock_expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("client", "employee_code")
        ordering = ["client__name", "full_name"]

    def __str__(self):
        return f"{self.full_name} ({self.employee_code})"


class MonthlyWorkEntry(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("submitted", "Submitted"),
        ("approved", "Approved"),
    ]

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="monthly_entries")
    resource = models.ForeignKey(ClientResource, on_delete=models.CASCADE, related_name="monthly_entries")
    year = models.IntegerField()
    month = models.IntegerField()
    expected_working_days = models.IntegerField(default=0)
    days_worked = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    leave_days = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    extra_days = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    total_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    payable_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    remarks = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    submitted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Pessimistic locking fields
    locked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='locked_monthly_entries')
    locked_at = models.DateTimeField(null=True, blank=True)
    lock_expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("resource", "year", "month")
        ordering = ["-year", "-month", "client__name", "resource__full_name"]


class PmoTimesheetData(models.Model):
    client_name = models.TextField()
    employee_code = models.TextField()
    employee_name = models.TextField()
    primary_skill = models.TextField(blank=True, null=True)
    po_number = models.TextField(blank=True, null=True)
    start_date = models.TextField(blank=True, null=True)
    end_date = models.TextField(blank=True, null=True)
    timesheet_month = models.TextField()
    timesheet_year = models.TextField(blank=True, null=True)
    billing_rate = models.FloatField(blank=True, null=True)
    leaves_taken = models.IntegerField(default=0)
    dates_of_leaves = models.TextField(blank=True, null=True)
    compoff_days = models.IntegerField(default=0)
    compoff_dates = models.TextField(blank=True, null=True)
    total_leave = models.IntegerField(default=0)
    pmo_billed_amount = models.FloatField(blank=True, null=True)
    source_file = models.TextField(blank=True, null=True)
    uploaded_at = models.DateTimeField(blank=True, null=True)
    status = models.TextField(default="pending")

    class Meta:
        managed = False
        db_table = "pmo_timesheet_data"


class FileUploadLog(models.Model):
    file_name = models.TextField()
    file_type = models.TextField(blank=True, null=True)
    file_path = models.TextField(blank=True, null=True)
    client_name = models.TextField(blank=True, null=True)
    month_year = models.TextField(blank=True, null=True)
    records_parsed = models.IntegerField(default=0)
    status = models.TextField(default="uploaded")
    error_message = models.TextField(blank=True, null=True)
    uploaded_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "file_upload_log"
