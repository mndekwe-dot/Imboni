from django.urls import path
from . import views

urlpatterns = [
    path('messages/contacts/', views.MessageContactsView.as_view(), name='message-contacts'),
    path('messages/conversations/', views.ConversationListCreateView.as_view(), name='conversations'),
    path('messages/conversations/<uuid:conversation_pk>/messages/', views.MessageListCreateView.as_view(), name='conversation-messages'),
]
