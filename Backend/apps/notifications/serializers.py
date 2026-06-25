from rest_framework import serializers
from .models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    time = serializers.SerializerMethodField()
    read = serializers.BooleanField(source='is_read')

    class Meta:
        model = Notification
        fields = ['id','title','message','type','path','read','time','created_at']
    
    def get_time(self,obj):
        from django.utils.timesince import timesince
        return f"{timesince(obj.created_at)} ago "