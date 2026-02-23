from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('__debug__/', include('debug_toolbar.urls')),
    path('api/', include('students.urls')),
    path('api/', include('authentication.urls')),
    #path('api/', include('results.urls')),
    #path('api/', include('attendance.urls')),
    #path('api/', include('behavior.urls')),
    #path('api/', include('messages.urls')),
    #path('api/', include('announcements.urls')),
    #path('api/', include('classes.urls')),
    #path('api/', include('analytics.urls')),
]
