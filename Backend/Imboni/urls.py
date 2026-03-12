from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('__debug__/', include('debug_toolbar.urls')),
    path('imboni/', include('parents.urls')),
    path('imboni/', include('authentication.urls')),
    path('imboni/', include('results.urls')),
    path('imboni/', include('messages.urls')),
    path('imboni/', include('teacher.urls')),
    path('imboni/', include('attendance.urls')),
    path('imboni/', include('behavior.urls')),
    path('imboni/', include('announcements.urls')),
    path('imboni/', include('dos.urls')),
    path('imboni/', include('student.urls')),
    path('imboni/', include('discipline.urls')),
    path('imboni/', include('matron.urls')),
]
