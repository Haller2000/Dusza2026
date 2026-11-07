from decimal import Decimal, ROUND_HALF_UP

from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar_id = models.PositiveSmallIntegerField(default=1)

    def __str__(self):
        return f'{self.user.username} profile'

class Map(models.Model):
    name = models.CharField(max_length=100)
    width = models.IntegerField()  # 1 és 15 között
    height = models.IntegerField() # 1 és 15 között
    map_data = models.TextField()  # A szöveges térképfájl 
    script = models.JSONField(default=list)  # Lista/tömb tárolása (ArrayField helyett)
    is_builtin = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='maps_created_by',
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['created_by', 'name'],
                condition=models.Q(is_builtin=False, created_by__isnull=False),
                name='unique_user_map_name',
            ),
        ]

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

    def save(self, *args, **kwargs):
        self.points = (
            (Decimal(self.gold_count) / Decimal(self.step_count)).quantize(
                Decimal('0.01'),
                rounding=ROUND_HALF_UP,
            )
            if self.step_count > 0
            else Decimal('0.00')
        )
        if kwargs.get('update_fields') is not None:
            kwargs['update_fields'] = set(kwargs['update_fields']) | {'points'}
        super().save(*args, **kwargs)
