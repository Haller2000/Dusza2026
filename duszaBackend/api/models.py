from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError

class Map(models.Model):
    name = models.CharField(max_length=100)
    width = models.IntegerField()  # 1 és 15 között
    height = models.IntegerField() # 1 és 15 között
    map_data = models.TextField()  # A szöveges térképfájl tartalma
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        super().clean()
        
        # 1. Méretek ellenőrzése (1 és 15 között)
        if not (1 <= self.width <= 15) or not (1 <= self.height <= 15):
            raise ValidationError("A térkép dimenzióinak 1 és 15 között kell lenniük!")

        # 2. Sorok és oszlopok száma / struktúra ellenőrzése
        rows = self.map_data.strip().split('\n')
        if len(rows) != self.height:
            raise ValidationError(f"A sorok száma ({len(rows)}) nem egyezik a megadott magassággal ({self.height})!")

        robot_count = 0
        valid_chars = {'.', '@', '#', '>', '<', '^', 'v'}

        for row in rows:
            if len(row.strip()) != self.width:
                raise ValidationError("Az egyik sor hossza nem egyezik a megadott szélességgel!")
            
            for char in row.strip():
                if char not in valid_chars:
                    raise ValidationError(f"Érvénytelen karakter a térképen: '{char}'")
                if char in {'>', '<', '^', 'v'}:
                    robot_count += 1

        # 3. Pontosan egy darab robotnak kell lennie a pályán
        if robot_count != 1:
            raise ValidationError(f"A térképen pontosan 1 robotnak kell lennie! Jelenleg darab van: {robot_count}")

    def save(self, *args, **kwargs):
        # Biztosítjuk, hogy mentés előtt lefusson a clean() vizsgálat adminban is!
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class Score(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    map = models.ForeignKey(Map, on_delete=models.CASCADE, related_name='scores')
    gold_count = models.IntegerField()     # Kibányászott aranyak száma
    step_count = models.IntegerField()     # Feldolgozott programsorok száma (lépés)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-gold_count', 'step_count']