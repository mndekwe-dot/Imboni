from django.urls import path
from . import views

urlpatterns = [
    path('admin/audit/', views.AuditLogListView.as_view(), name='admin-audit-log'),
]
