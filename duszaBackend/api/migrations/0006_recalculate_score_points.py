from decimal import Decimal, ROUND_HALF_UP

from django.db import migrations


def recalculate_score_points(apps, schema_editor):
    Score = apps.get_model('api', 'Score')
    scores = Score.objects.all()
    for score in scores.iterator():
        score.points = (
            (Decimal(score.gold_count) / Decimal(score.step_count)).quantize(
                Decimal('0.01'),
                rounding=ROUND_HALF_UP,
            )
            if score.step_count > 0
            else Decimal('0.00')
        )
        score.save(update_fields=['points'])


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_seed_builtin_maps'),
    ]

    operations = [
        migrations.RunPython(recalculate_score_points, migrations.RunPython.noop),
    ]
