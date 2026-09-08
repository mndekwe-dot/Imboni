from django.urls import path
from . import views

urlpatterns = [
    path('notifications/',              views.NotificationListView.as_view(),         name='notifications-list'),
    path('notifications/read-all/',     views.NotificationMarkAllReadView.as_view(),  name='notifications-read-all'),
    path('notifications/<uuid:pk>/read/', views.NotificationMarkReadView.as_view(),    name='notifications-mark-read'),
    path('notifications/push/key/',       views.PushPublicKeyView.as_view(),       name='notifications-push-key'),
    path('notifications/push/subscribe/', views.PushSubscribeView.as_view(),       name='notifications-push-subscribe'),
]
