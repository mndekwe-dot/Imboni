from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('__debug__/', include('debug_toolbar.urls')),
    path('imboni/', include('students.urls')),
    path('imboni/', include('authentication.urls')),
    path('imboni/', include('results.urls')),
    #path('api/', include('attendance.urls')),
    # Uncomment as you build each app:
    #path('imboni/', include('attendance.urls')),
    #path('imboni/', include('behavior.urls')),
    #path('imboni/', include('announcements.urls')),
]
