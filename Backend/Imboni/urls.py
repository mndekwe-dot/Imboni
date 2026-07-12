from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    # /django-admin/ (not /admin/) so the React admin portal owns /admin/*.
    path('django-admin/', admin.site.urls),
    path('imboni/', include('apps.parents.urls')),
    path('imboni/', include('apps.authentication.urls')),
    path('imboni/', include('apps.results.urls')),
    path('imboni/', include('apps.messages.urls')),
    path('imboni/', include('apps.teacher.urls')),
    path('imboni/', include('apps.attendance.urls')),
    path('imboni/', include('apps.behavior.urls')),
    path('imboni/', include('apps.announcements.urls')),
    path('imboni/', include('apps.dos.urls')),
    path('imboni/', include('apps.student.urls')),
    path('imboni/', include('apps.discipline.urls')),
    path('imboni/', include('apps.matron.urls')),
    path('imboni/', include('apps.analytics.urls')),
    path('imboni/', include('apps.notifications.urls')),
    path('imboni/', include('apps.audit.urls')),
    # School-facing billing (tenant subdomain, admin-authenticated).
    path('', include('apps.tenants.billing_urls')),
]
if settings.DEBUG:
    # debug_toolbar is only in INSTALLED_APPS when DEBUG=True, so its URLs
    # (which import its models) must only be wired up then — otherwise a
    # DEBUG=False run fails with "model isn't in an application in INSTALLED_APPS".
    urlpatterns += [path('__debug__/', include('debug_toolbar.urls'))]
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
