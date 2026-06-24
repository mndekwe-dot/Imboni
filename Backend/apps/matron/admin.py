from django.contrib import admin
from .models import HealthRecord, ParentCommunication, BoardingScheduleSlot, BoardingScheduleChange
# DisciplineStaff (which includes matrons) is managed in discipline/admin.py.

admin.site.register(HealthRecord)
admin.site.register(ParentCommunication)
admin.site.register(BoardingScheduleSlot)
admin.site.register(BoardingScheduleChange)
