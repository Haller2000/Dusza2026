from rest_framework import serializers
from .models import Map, Score
from django.contrib.auth.models import User

class MapSerializer(serializers.ModelSerializer):
    class Meta:
        model = Map
        fields = ['id', 'name', 'width', 'height', 'map_data', 'created_by', 'created_at']
        read_only_fields = ['created_by', 'created_at'] # Ezt automatikusan beállítjuk mentéskor

class ScoreSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username') # Hogy látszódjon a ranglistán a név

    class Meta:
        model = Score
        fields = ['id', 'user', 'username', 'map', 'gold_count', 'step_count', 'created_at']
        read_only_fields = ['user', 'created_at']