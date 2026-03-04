from django.utils import timezone
from rest_framework import serializers
from .models import Announcement


class AnnouncementSerializer(serializers.ModelSerializer):
    """
    Read serializer — powers the list and detail views.
    author_name: full name of the teacher who created it.
    """
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = [
            'id', 'title', 'content', 'category', 'target_audience',
            'target_grade', 'status', 'published_at', 'expires_at',
            'attachment', 'created_at', 'updated_at', 'author_name',
        ]

    def get_author_name(self, obj):
        if obj.author:
            return obj.author.get_full_name() or obj.author.username
        return ''


class AnnouncementWriteSerializer(serializers.ModelSerializer):
    """
    Write serializer — used for create (POST) and update (PATCH).

    status options:
        'draft'     — Save Draft
        'published' — Publish Now (sets published_at to now if not provided)

    For "Schedule": pass status='published' with a future published_at datetime.
    """
    class Meta:
        model = Announcement
        fields = [
            'title', 'content', 'category', 'target_audience',
            'target_grade', 'status', 'published_at', 'expires_at',
            'attachment',
        ]

    def validate(self, data):
        # Auto-set published_at when publishing now and it wasn't provided
        if data.get('status') == 'published' and not data.get('published_at'):
            data['published_at'] = timezone.now()
        return data
