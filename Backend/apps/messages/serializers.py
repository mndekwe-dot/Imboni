from rest_framework import serializers
from .models import Conversation, Message

# Roles considered "staff". Students and parents may only message staff.
STAFF_ROLES = {'teacher', 'dos', 'discipline', 'matron', 'admin'}

ROLE_LABELS = {
    'student': 'Student', 'parent': 'Parent', 'teacher': 'Teacher',
    'dos': 'Director of Studies', 'discipline': 'Discipline', 'matron': 'Matron',
    'admin': 'Admin',
}


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.ReadOnlyField(source='sender.get_full_name')
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'sender', 'sender_name', 'is_mine', 'content', 'attachment',
                  'attachment_name', 'is_read', 'read_at', 'created_at']
        read_only_fields = ['id', 'sender', 'is_read', 'read_at', 'created_at']

    def get_is_mine(self, obj):
        request = self.context.get('request')
        return bool(request and obj.sender_id == request.user.id)


class ConversationSerializer(serializers.ModelSerializer):
    last_message = serializers.SerializerMethodField()
    participant_names = serializers.SerializerMethodField()
    other_participant = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ['id', 'participants', 'subject', 'is_group',
                  'participant_names', 'other_participant', 'unread_count',
                  'last_message', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_last_message(self, obj):
        msg = obj.messages.last()
        if msg:
            return {
                'content': msg.content,
                'sender_name': msg.sender.get_full_name(),
                'created_at': msg.created_at,
            }
        return None

    def get_participant_names(self, obj):
        return [p.get_full_name() for p in obj.participants.all()]

    def get_other_participant(self, obj):
        """For a 1-to-1 conversation, the participant who isn't the requester —
        this is what the frontend shows as the contact (name + role)."""
        request = self.context.get('request')
        me_id = request.user.id if request else None
        others = [p for p in obj.participants.all() if p.id != me_id]
        if len(others) != 1:
            return None
        other = others[0]
        return {
            'id': str(other.id),
            'name': other.get_full_name(),
            'role': other.role,
            'role_label': ROLE_LABELS.get(other.role, other.role),
        }

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request:
            return 0
        return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
