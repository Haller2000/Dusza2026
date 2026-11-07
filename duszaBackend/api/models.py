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
    width = models.IntegerField()
    height = models.IntegerField()
    map_data = models.TextField()
    script = models.JSONField(default=list)
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
    map_snapshot = models.JSONField(default=dict, blank=True)
    map_complete = models.TextField(default='')
    points = models.DecimalField(max_digits=10, decimal_places=2, default=0.00) 
    script = models.JSONField(default=list, null=True, blank=True)
    step_count = models.IntegerField(default=0)
    steps = models.JSONField(default=list)
    gold_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.map_snapshot:
            map_obj = self.map
            self.map_snapshot = {
                'name': map_obj.name,
                'width': map_obj.width,
                'height': map_obj.height,
                'map_data': map_obj.map_data,
                'is_builtin': map_obj.is_builtin,
            }
        self.points = (
            (Decimal(self.gold_count) / Decimal(self.step_count) * Decimal('100')).quantize(
                Decimal('0.01'),
                rounding=ROUND_HALF_UP,
            )
            if self.step_count > 0
            else Decimal('0.00')
        )
        if kwargs.get('update_fields') is not None:
            kwargs['update_fields'] = set(kwargs['update_fields']) | {'points'}
        super().save(*args, **kwargs)
