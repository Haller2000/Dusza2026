from django.db import models
from django.contrib.auth.models import User

class Map(models.Model):
    name = models.CharField(max_length=100)
    width = models.IntegerField()  # 1 és 15 között
    height = models.IntegerField() # 1 és 15 között
    map_data = models.TextField()  # A szöveges térképfájl 
    script = models.JSONField(default=list)  # Lista/tömb tárolása (ArrayField helyett)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='maps_created_by')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Score(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    map = models.ForeignKey(Map, on_delete=models.CASCADE, related_name='scores')
    map_complete = models.TextField(default='') # A térkép befejezésének állapota (pl. "completed", "in_progress", stb.)
    points = models.DecimalField(max_digits=10, decimal_places=2, default=0.00) 
    script = models.JSONField(default=list, null=True, blank=True) # A futtatott script kódja lista formátumban
    step_count = models.IntegerField(default=0)
    steps = models.JSONField(default=list) # A megtett lépések listája (ArrayField helyett)
    gold_count = models.IntegerField(default=0)     # Kibányászott aranyak száma
    created_at = models.DateTimeField(auto_now_add=True)

