from django.db import migrations


BUILTIN_MAPS = [
    {
        'name': 'Első lépések',
        'width': 9,
        'height': 5,
        'map_data': '#########\n#>..@...#\n#.......#\n#...@...#\n#########',
    },
    {
        'name': 'Két ösvény',
        'width': 9,
        'height': 5,
        'map_data': '#########\n#>..#...#\n#.@.#.@.#\n#...#...#\n#########',
    },
    {
        'name': 'Kanyargós út',
        'width': 9,
        'height': 5,
        'map_data': '#########\n#>......#\n###.###.#\n#@..@...#\n#########',
    },
    {
        'name': 'Aranymező',
        'width': 9,
        'height': 5,
        'map_data': '#########\n#.@.@.@.#\n#...>...#\n#.@.@.@.#\n#########',
    },
    {
        'name': 'Szűk átjáró',
        'width': 9,
        'height': 5,
        'map_data': '#########\n#>..#..@#\n#.#...#.#\n#@..#...#\n#########',
    },
]


def create_builtin_maps(apps, schema_editor):
    Map = apps.get_model('api', 'Map')
    for map_data in BUILTIN_MAPS:
        Map.objects.update_or_create(
            name=map_data['name'],
            is_builtin=True,
            defaults={
                'width': map_data['width'],
                'height': map_data['height'],
                'map_data': map_data['map_data'],
                'created_by_id': None,
                'script': [],
            },
        )


def remove_builtin_maps(apps, schema_editor):
    Map = apps.get_model('api', 'Map')
    Map.objects.filter(is_builtin=True, name__in=[map_data['name'] for map_data in BUILTIN_MAPS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_map_is_builtin_alter_map_created_by'),
    ]

    operations = [
        migrations.RunPython(create_builtin_maps, remove_builtin_maps),
    ]
