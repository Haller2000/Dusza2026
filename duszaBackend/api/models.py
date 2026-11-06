from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError

class Map(models.Model):
    name = models.CharField(max_length=100)
    width = models.IntegerField()  # 1 és 15 között
    height = models.IntegerField() # 1 és 15 között
    map_data = models.TextField()  # A szöveges térképfájl 
    script = models.ArrayField(models.TextField())  # A térképhez tartozó script
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Score(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    map = models.ForeignKey(Map, on_delete=models.CASCADE, related_name='scores')
    map_complete = models.TextField()
    points = models.DecimalField(max_digits=10, decimal_places=2, default=0.00) 
    script = models.ForeignKey(Map.script, on_delete=models.CASCADE, null=True, blank=True)
    step_count = models.IntegerField()
    steps = models.ArrayField(models.CharField(max_length=1), size=1000)
    gold_count = models.IntegerField()     # Kibányászott aranyak száma
    created_at = models.DateTimeField(auto_now_add=True)
