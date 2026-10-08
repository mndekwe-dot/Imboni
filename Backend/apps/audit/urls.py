from django.urls import path

from .api import AuditLogView

urlpatterns = [
    path('audit/', AuditLogView.as_view(), name='audit-log'),
]
