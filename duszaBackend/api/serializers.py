from rest_framework import serializers
from .models import Map, Score
from django.contrib.auth.models import User

class MapSerializer(serializers.ModelSerializer):
    class Meta:
        model = Map
        fields = ['id', 'name', 'width', 'height', 'map_data', 'is_builtin', 'created_by', 'created_at']
        read_only_fields = ['is_builtin', 'created_by', 'created_at']

    def validate(self, data):
        width = data.get('width')
        height = data.get('height')
        map_data = data.get('map_data')

        # 1. Méretek ellenőrzése (1 és 15 között)
        if not (1 <= width <= 15) or not (1 <= height <= 15):
            raise serializers.ValidationError("A térkép dimenzióinak 1 és 15 között kell lenniük!")

        # 2. Sorok és oszlopok száma / struktúra ellenőrzése
        # A map_data-ban a sorokat új sor (\n) karakterek választják el
        rows = map_data.strip().split('\n')
        if len(rows) != height:
            raise serializers.ValidationError(f"A sorok száma ({len_rows = }) nem egyezik a megadott magassággal ({height})!")

        robot_count = 0
        valid_chars = {'.', '@', '#', '>', '<', '^', 'v'}

        for row in rows:
            if len(row.strip()) != width:
                raise serializers.ValidationError("Az egyik sor hossza nem egyezik a megadott szélességgel!")
            
            for char in row.strip():
                if char not in valid_chars:
                    raise serializers.ValidationError(f"Érvénytelen karakter a térképen: '{char}'")
                if char in {'>', '<', '^', 'v'}:
                    robot_count += 1

        # 3. Pontosan egy darab robotnak kell lennie a pályán
        if robot_count != 1:
            raise serializers.ValidationError(f"A térképen pontosan 1 robotnak kell lennie! Jelenleg darab van: {robot_count}")

        return data

class ScoreSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Score
        fields = ['id', 'user', 'username', 'map', 'gold_count', 'step_count', 'created_at']
        read_only_fields = ['user', 'created_at']