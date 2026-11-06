from django.db import models

# Create your models here.
from django.db import models
from django.contrib.auth.models import User

class Map(models.Model):
    name = models.CharField(max_length=100)
    width = models.IntegerField()  # 1 és 15 között
    height = models.IntegerField() # 1 és 15 között
    map_data = models.TextField()  # A szöveges térképfájl tartalma
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Score(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    map = models.ForeignKey(Map, on_delete=models.CASCADE, related_name='scores')
    gold_count = models.IntegerField()     # Kibányászott aranyak száma
    step_count = models.IntegerField()     # Feldolgozott programsorok száma (lépés)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # A ranglistához: előbb több arany (csökkenő), azonnal kevesebb lépés (növekvő)[cite: 8]
        ordering = ['-gold_count', 'step_count']