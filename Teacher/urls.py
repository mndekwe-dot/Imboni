from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'teacher', views.TeacherViewSet, basename='teacher')

urlpatterns = router.urls + [
    path('teacher/my-timetable/', views.MyTimetableView.as_view(), name='teacher-my-timetable'),
    path('teacher/my-timetable/today/', views.MyTodayScheduleView.as_view(), name='teacher-today-schedule'),
]
