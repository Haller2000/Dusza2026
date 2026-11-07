from django.db import migrations, models


def rename_duplicate_user_maps(apps, schema_editor):
    Map = apps.get_model('api', 'Map')
    database = schema_editor.connection.alias
    user_maps = list(
        Map.objects.using(database)
        .filter(is_builtin=False, created_by__isnull=False)
        .order_by('created_by_id', 'name', 'created_at', 'id')
    )

    used_names = {}
    duplicate_groups = {}
    for map_obj in user_maps:
        owner_names = used_names.setdefault(map_obj.created_by_id, set())
        owner_names.add(map_obj.name)
        duplicate_groups.setdefault((map_obj.created_by_id, map_obj.name), []).append(map_obj)

    for (owner_id, original_name), maps in duplicate_groups.items():
        if len(maps) < 2:
            continue

        owner_names = used_names[owner_id]
        for index, map_obj in enumerate(maps[1:], start=2):
            suffix_index = index
            while True:
                suffix = f' ({suffix_index})'
                candidate_name = f'{original_name[:100 - len(suffix)]}{suffix}'
                if candidate_name not in owner_names:
                    break
                suffix_index += 1

            Map.objects.using(database).filter(pk=map_obj.pk).update(name=candidate_name)
            owner_names.add(candidate_name)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_recalculate_score_points'),
    ]

    operations = [
        migrations.RunPython(rename_duplicate_user_maps, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='map',
            constraint=models.UniqueConstraint(
                condition=models.Q(('created_by__isnull', False), ('is_builtin', False)),
                fields=('created_by', 'name'),
                name='unique_user_map_name',
            ),
        ),
    ]
