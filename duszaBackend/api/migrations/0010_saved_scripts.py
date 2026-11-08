import json

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def migrate_scripts(apps, schema_editor):
    Map = apps.get_model('api', 'Map')
    Score = apps.get_model('api', 'Score')
    Script = apps.get_model('api', 'Script')
    database = schema_editor.connection.alias

    def get_code(value):
        if isinstance(value, list):
            return '\n'.join(str(line) for line in value)
        if isinstance(value, str):
            return value
        return json.dumps(value, ensure_ascii=False)

    for map_obj in Map.objects.using(database).all().iterator():
        if map_obj.script:
            script = Script.objects.using(database).create(
                name=f'Migrált pályascript {map_obj.pk}',
                code=get_code(map_obj.script),
                created_by_id=map_obj.created_by_id,
            )
            map_obj.script_ref_id = script.pk
            map_obj.save(update_fields=['script_ref'])

    for score in Score.objects.using(database).all().iterator():
        if score.script:
            script = Script.objects.using(database).create(
                name=f'Futtatott script {score.pk}',
                code=get_code(score.script),
                created_by_id=score.user_id,
            )
            score.script_ref_id = script.pk
            score.save(update_fields=['script_ref'])


def restore_scripts(apps, schema_editor):
    Map = apps.get_model('api', 'Map')
    Score = apps.get_model('api', 'Score')
    Script = apps.get_model('api', 'Script')
    database = schema_editor.connection.alias

    for model in (Map, Score):
        for item in model.objects.using(database).all().iterator():
            script_id = item.script_ref_id
            item.script = [Script.objects.using(database).get(pk=script_id).code] if script_id else []
            item.save(update_fields=['script'])


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_add_score_map_snapshot'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Script',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('code', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='scripts_created_by',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
        migrations.AddField(
            model_name='map',
            name='script_ref',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='api.script',
            ),
        ),
        migrations.AddField(
            model_name='score',
            name='script_ref',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='api.script',
            ),
        ),
        migrations.RunPython(migrate_scripts, restore_scripts),
        migrations.RemoveField(
            model_name='map',
            name='script',
        ),
        migrations.RemoveField(
            model_name='score',
            name='script',
        ),
        migrations.RenameField(
            model_name='map',
            old_name='script_ref',
            new_name='script',
        ),
        migrations.RenameField(
            model_name='score',
            old_name='script_ref',
            new_name='script',
        ),
        migrations.AlterField(
            model_name='map',
            name='script',
            field=models.ForeignKey(
                blank=True,
                default=None,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='api.script',
            ),
        ),
        migrations.AlterField(
            model_name='score',
            name='script',
            field=models.ForeignKey(
                blank=True,
                default=None,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='api.script',
            ),
        ),
        migrations.AddConstraint(
            model_name='script',
            constraint=models.UniqueConstraint(
                condition=models.Q(('created_by__isnull', False)),
                fields=('created_by', 'name'),
                name='unique_user_script_name',
            ),
        ),
    ]
