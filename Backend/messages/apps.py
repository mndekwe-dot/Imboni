from django.apps import AppConfig


class MessagesConfig(AppConfig):
    name = 'messages'
    label = 'school_messages'  # Avoids conflict with django.contrib.messages
