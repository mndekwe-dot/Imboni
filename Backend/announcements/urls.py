from django.urls import path
from . import views

urlpatterns = [
    # List (with ?tab=all|academic|events|general|drafts) + Create
    path('announcements/teacher/',                views.TeacherAnnouncementListCreateView.as_view(), name='teacher-announcements'),
    # Retrieve / Update (PATCH) / Delete
    path('announcements/teacher/<uuid:pk>/',      views.TeacherAnnouncementDetailView.as_view(),     name='teacher-announcement-detail'),
    # Quick Templates chips
    path('announcements/teacher/templates/',      views.AnnouncementTemplatesView.as_view(),         name='teacher-announcement-templates'),
    # Target audience options (teacher's classes + All + Parents Only)
    path('announcements/teacher/audience-options/', views.AnnouncementAudienceOptionsView.as_view(), name='teacher-announcement-audience'),
]
