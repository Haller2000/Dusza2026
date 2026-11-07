from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase
from .models import Map, Score, UserProfile


class MapAccessTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='password123')
        self.other_user = User.objects.create_user(username='other', password='password123')
        self.owner_map = Map.objects.create(
            name='Owner map',
            width=2,
            height=1,
            map_data='>#',
            created_by=self.owner,
        )
        self.other_map = Map.objects.create(
            name='Other map',
            width=2,
            height=1,
            map_data='>#',
            created_by=self.other_user,
        )

    def test_map_list_contains_only_current_users_maps(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.get(reverse('map-list'))

        self.assertEqual(response.status_code, 200)
        map_ids = {map_data['id'] for map_data in response.data}
        builtin_ids = set(Map.objects.filter(is_builtin=True).values_list('id', flat=True))
        self.assertEqual(map_ids, builtin_ids | {self.owner_map.id})
        self.assertNotIn(self.other_map.id, map_ids)

    def test_five_builtin_maps_are_available_to_every_user(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.get(reverse('map-list'))

        builtin_maps = [map_data for map_data in response.data if map_data['is_builtin']]
        self.assertEqual(len(builtin_maps), 5)
        for map_data in builtin_maps:
            rows = map_data['map_data'].splitlines()
            self.assertEqual(len(rows), map_data['height'])
            self.assertTrue(all(len(row) == map_data['width'] for row in rows))
            self.assertEqual(
                sum(row.count(robot) for row in rows for robot in '<>^v'),
                1,
            )

        self.client.force_authenticate(user=self.other_user)
        other_response = self.client.get(reverse('map-list'))
        self.assertEqual(
            {item['id'] for item in other_response.data if item['is_builtin']},
            {item['id'] for item in builtin_maps},
        )

    def test_builtin_maps_can_be_read_but_not_changed_or_deleted(self):
        self.client.force_authenticate(user=self.owner)
        builtin_map = Map.objects.filter(is_builtin=True).first()

        retrieve_response = self.client.get(reverse('map-detail', args=[builtin_map.id]))
        update_response = self.client.patch(
            reverse('map-detail', args=[builtin_map.id]),
            {'name': 'Changed template'},
        )
        delete_response = self.client.delete(reverse('map-detail', args=[builtin_map.id]))

        self.assertEqual(retrieve_response.status_code, 200)
        self.assertEqual(update_response.status_code, 403)
        self.assertEqual(delete_response.status_code, 403)
        builtin_map.refresh_from_db()
        self.assertNotEqual(builtin_map.name, 'Changed template')

    def test_user_cannot_retrieve_another_users_map(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.get(reverse('map-detail', args=[self.other_map.id]))

        self.assertEqual(response.status_code, 404)

    def test_map_list_requires_authentication(self):
        response = self.client.get(reverse('map-list'))

        self.assertEqual(response.status_code, 401)

    def test_new_map_is_created_for_authenticated_user(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(reverse('map-list'), {
            'name': 'New map',
            'width': 2,
            'height': 1,
            'map_data': '>@',
            'is_builtin': True,
        })

        self.assertEqual(response.status_code, 201)
        created_map = Map.objects.get(id=response.data['id'])
        self.assertEqual(created_map.created_by, self.owner)
        self.assertFalse(created_map.is_builtin)

    def test_user_cannot_create_two_maps_with_the_same_name(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(reverse('map-list'), {
            'name': self.owner_map.name,
            'width': 2,
            'height': 1,
            'map_data': '>@'
        })

        self.assertEqual(response.status_code, 400)
        self.assertIn('name', response.data)
        self.assertEqual(
            response.data['name'][0],
            'Nem menthető a pálya, mert már van saját pályád ugyanezzel a névvel.',
        )

    def test_database_duplicate_name_error_returns_a_friendly_api_response(self):
        self.client.force_authenticate(user=self.owner)

        with patch(
            'api.serializers.MapSerializer.validate_name',
            side_effect=lambda value: value,
        ):
            response = self.client.post(reverse('map-list'), {
                'name': self.owner_map.name,
                'width': 2,
                'height': 1,
                'map_data': '>@',
            })

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data['name'][0],
            'Nem menthető a pálya, mert már van saját pályád ugyanezzel a névvel.',
        )
        self.assertEqual(Map.objects.filter(created_by=self.owner, name=self.owner_map.name).count(), 1)

    def test_different_users_can_create_maps_with_the_same_name(self):
        self.client.force_authenticate(user=self.other_user)

        response = self.client.post(reverse('map-list'), {
            'name': self.owner_map.name,
            'width': 2,
            'height': 1,
            'map_data': '>@'
        })

        self.assertEqual(response.status_code, 201)

    def test_user_can_update_the_loaded_map_without_creating_a_duplicate(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.put(
            reverse('map-detail', args=[self.owner_map.id]),
            {
                'name': self.owner_map.name,
                'width': 2,
                'height': 1,
                'map_data': '@>',
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Map.objects.filter(created_by=self.owner, name=self.owner_map.name).count(), 1)
        self.owner_map.refresh_from_db()
        self.assertEqual(self.owner_map.map_data, '@>')

    def test_user_cannot_rename_map_to_another_owned_maps_name(self):
        self.client.force_authenticate(user=self.owner)
        another_owned_map = Map.objects.create(
            name='Another owner map',
            width=2,
            height=1,
            map_data='>#',
            created_by=self.owner,
        )

        response = self.client.patch(
            reverse('map-detail', args=[self.owner_map.id]),
            {'name': another_owned_map.name},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('name', response.data)

    def test_map_cannot_be_saved_without_gold(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(reverse('map-list'), {
            'name': 'Map without gold',
            'width': 2,
            'height': 1,
            'map_data': '>.',
        })

        self.assertEqual(response.status_code, 400)
        self.assertIn('arany', response.data['map_data'][0])
        self.assertFalse(Map.objects.filter(name='Map without gold').exists())

    def test_map_cannot_be_saved_without_robot(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(reverse('map-list'), {
            'name': 'Map without robot',
            'width': 2,
            'height': 1,
            'map_data': '@.',
        })

        self.assertEqual(response.status_code, 400)
        self.assertIn('robot', response.data['map_data'][0])
        self.assertFalse(Map.objects.filter(name='Map without robot').exists())


class UserProfileTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='profile-user', password='Original-Pass-482!')

    def test_registration_saves_selected_avatar(self):
        response = self.client.post(reverse('register'), {
            'username': 'new-player',
            'password': '1',
            'avatar_id': 12,
        })

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['avatar_id'], 12)
        self.assertTrue(User.objects.get(username='new-player').check_password('1'))
        self.assertEqual(
            UserProfile.objects.get(user__username='new-player').avatar_id,
            12,
        )

    def test_profile_returns_user_data_and_updates_avatar(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(reverse('profile'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['username'], self.user.username)
        self.assertEqual(response.data['avatar_id'], 1)
        self.assertNotIn('password', response.data)

        response = self.client.patch(reverse('profile'), {'avatar_id': 20})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['avatar_id'], 20)
        self.assertEqual(UserProfile.objects.get(user=self.user).avatar_id, 20)

    def test_profile_rejects_out_of_range_avatar(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(reverse('profile'), {'avatar_id': 21})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(UserProfile.objects.get(user=self.user).avatar_id, 1)

    def test_profile_and_password_change_require_authentication(self):
        profile_response = self.client.get(reverse('profile'))
        password_response = self.client.post(reverse('change-password'), {})

        self.assertEqual(profile_response.status_code, 401)
        self.assertEqual(password_response.status_code, 401)

    def test_password_change_checks_current_password_and_updates_password(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(reverse('change-password'), {
            'old_password': 'wrong-password',
            'new_password': 'New-Strong-Pass-753!',
            'confirm_password': 'New-Strong-Pass-753!',
        })
        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Original-Pass-482!'))

        response = self.client.post(reverse('change-password'), {
            'old_password': 'Original-Pass-482!',
            'new_password': '1',
            'confirm_password': '1',
        })
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('1'))


class UserStatisticsTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='stats-user', password='password123')
        self.other_user = User.objects.create_user(username='other-stats-user', password='password123')
        self.map = Map.objects.create(
            name='Stats map',
            width=2,
            height=1,
            map_data='>@',
            created_by=self.user,
        )
        self.other_map = Map.objects.create(
            name='Other stats map',
            width=2,
            height=1,
            map_data='>@',
            created_by=self.other_user,
        )

    def test_statistics_aggregate_only_current_users_scores(self):
        Score.objects.create(
            user=self.user,
            map=self.map,
            gold_count=2,
            step_count=7,
            steps=[],
        )
        Score.objects.create(
            user=self.user,
            map=self.map,
            gold_count=1,
            step_count=4,
            steps=[],
        )
        Score.objects.create(
            user=self.other_user,
            map=self.other_map,
            gold_count=99,
            step_count=1,
            steps=[],
        )
        self.client.force_authenticate(user=self.user)

        response = self.client.get(reverse('statistics'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['games_played'], 2)
        self.assertEqual(response.data['total_gold'], 3)
        self.assertEqual(response.data['total_steps'], 11)
        self.assertEqual(response.data['total_points'], Decimal('53.57'))
        self.assertEqual(response.data['average_points'], Decimal('26.785'))
        self.assertEqual(response.data['best_points'], Decimal('28.57'))
        self.assertEqual(response.data['best_gold'], 2)
        self.assertEqual(len(response.data['recent_games']), 2)
        self.assertTrue(all(item['map_name'] == self.map.name for item in response.data['recent_games']))
        self.assertEqual(response.data['recent_games'][0]['map_snapshot'], {
            'name': self.map.name,
            'width': self.map.width,
            'height': self.map.height,
            'map_data': self.map.map_data,
            'is_builtin': self.map.is_builtin,
        })

    def test_score_keeps_map_snapshot_when_original_map_changes(self):
        score = Score.objects.create(
            user=self.user,
            map=self.map,
            gold_count=1,
            step_count=3,
            steps=[],
        )
        self.map.name = 'Updated map'
        self.map.map_data = '>@'
        self.map.save()
        self.client.force_authenticate(user=self.user)

        response = self.client.get(reverse('statistics'))

        self.assertEqual(response.status_code, 200)
        recent_game = next(item for item in response.data['recent_games'] if item['id'] == score.id)
        self.assertEqual(recent_game['map_name'], 'Updated map')
        self.assertEqual(recent_game['map_snapshot']['name'], 'Stats map')
        self.assertEqual(recent_game['map_snapshot']['map_data'], '>@')

    def test_score_points_are_gold_divided_by_steps_times_100(self):
        score = Score.objects.create(
            user=self.user,
            map=self.map,
            gold_count=1,
            step_count=8,
            steps=[],
        )

        self.assertEqual(score.points, Decimal('12.50'))

    def test_zero_steps_produce_zero_points(self):
        score = Score.objects.create(
            user=self.user,
            map=self.map,
            gold_count=3,
            step_count=0,
            steps=[],
        )

        self.assertEqual(score.points, Decimal('0.00'))

    def test_score_endpoint_calculates_points_instead_of_accepting_client_value(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse('score-list'),
            {
                'map': self.map.id,
                'gold_count': 2,
                'step_count': 4,
                'points': '999.99',
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['points'], '50.00')

    def test_updating_gold_or_steps_recalculates_points(self):
        score = Score.objects.create(
            user=self.user,
            map=self.map,
            gold_count=1,
            step_count=4,
            steps=[],
        )

        score.gold_count = 3
        score.step_count = 6
        score.save(update_fields=['gold_count', 'step_count'])

        self.assertEqual(score.points, Decimal('50.00'))

    def test_score_list_is_ordered_by_points(self):
        lower_score = Score.objects.create(
            user=self.user,
            map=self.map,
            gold_count=1,
            step_count=4,
            steps=[],
        )
        higher_score = Score.objects.create(
            user=self.other_user,
            map=self.other_map,
            gold_count=1,
            step_count=2,
            steps=[],
        )
        self.client.force_authenticate(user=self.user)

        response = self.client.get(reverse('score-list'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['id'] for item in response.data], [higher_score.id, lower_score.id])

    def test_empty_statistics_return_zero_totals_and_no_games(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(reverse('statistics'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['games_played'], 0)
        self.assertEqual(response.data['total_gold'], 0)
        self.assertEqual(response.data['total_steps'], 0)
        self.assertEqual(response.data['recent_games'], [])

    def test_statistics_require_authentication(self):
        response = self.client.get(reverse('statistics'))

        self.assertEqual(response.status_code, 401)
