from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('__debug__/', include('debug_toolbar.urls')),
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
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
