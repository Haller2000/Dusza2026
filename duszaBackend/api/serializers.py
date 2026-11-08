from rest_framework import serializers
from .models import Map, Score, Script
from django.contrib.auth.models import User

class MapSerializer(serializers.ModelSerializer):
    class Meta:
        model = Map
        fields = ['id', 'name', 'width', 'height', 'map_data', 'is_builtin', 'created_by', 'created_at']
        read_only_fields = ['is_builtin', 'created_by', 'created_at']

    def validate_name(self, value):
        user = self.context['request'].user
        matching_maps = Map.objects.filter(
            created_by=user,
            is_builtin=False,
            name=value,
        )
        if self.instance:
            matching_maps = matching_maps.exclude(pk=self.instance.pk)
        if matching_maps.exists():
            raise serializers.ValidationError(
                'Nem menthető a pálya, mert már van saját pályád ugyanezzel a névvel.'
            )
        return value

    def validate(self, data):
        width = data.get('width', self.instance.width if self.instance else None)
        height = data.get('height', self.instance.height if self.instance else None)
        map_data = data.get('map_data', self.instance.map_data if self.instance else None)

        if not (1 <= width <= 15) or not (1 <= height <= 15):
            raise serializers.ValidationError("A térkép dimenzióinak 1 és 15 között kell lenniük!")

        rows = map_data.strip().split('\n')
        if len(rows) != height:
            raise serializers.ValidationError(f"A sorok száma ({len_rows = }) nem egyezik a megadott magassággal ({height})!")

        robot_count = 0
        gold_count = 0
        valid_chars = {'.', '@', '#', '>', '<', '^', 'v'}

        for row in rows:
            if len(row.strip()) != width:
                raise serializers.ValidationError("Az egyik sor hossza nem egyezik a megadott szélességgel!")
            
            for char in row.strip():
                if char not in valid_chars:
                    raise serializers.ValidationError(f"Érvénytelen karakter a térképen: '{char}'")
                if char in {'>', '<', '^', 'v'}:
                    robot_count += 1
                elif char == '@':
                    gold_count += 1

        if gold_count == 0:
            raise serializers.ValidationError({
                'map_data': 'A pálya csak akkor menthető, ha legalább egy arany is van rajta.'
            })

        if robot_count != 1:
            raise serializers.ValidationError({
                'map_data': f'A pályán pontosan egy robotnak kell lennie. Jelenleg {robot_count} van.'
            })

        return data

class ScoreSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')
    map_name = serializers.ReadOnlyField(source='map.name')
    map_is_builtin = serializers.ReadOnlyField(source='map.is_builtin')

    class Meta:
        model = Score
        fields = [
            'id',
            'user',
            'username',
            'map',
            'map_name',
            'map_is_builtin',
            'gold_count',
            'step_count',
            'steps',
            'points',
            'created_at',
        ]
        read_only_fields = ['user', 'points', 'created_at']


class ScriptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Script
        fields = ['id', 'name', 'code', 'created_by', 'created_at']
        read_only_fields = ['created_by', 'created_at']

    def validate_name(self, value):
        user = self.context['request'].user
        matching_scripts = Script.objects.filter(created_by=user, name=value)
        if self.instance:
            matching_scripts = matching_scripts.exclude(pk=self.instance.pk)
        if matching_scripts.exists():
            raise serializers.ValidationError(
                'Már van mentett scripted ugyanezzel a névvel.'
            )
        return value