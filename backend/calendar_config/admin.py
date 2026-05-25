from django.contrib import admin
from .models import Holiday, WorkingDayConfig


admin.site.register(WorkingDayConfig)
admin.site.register(Holiday)
