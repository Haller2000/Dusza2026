from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase
from .models import Map, UserProfile


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
            'map_data': '>.',
            'is_builtin': True,
        })

        self.assertEqual(response.status_code, 201)
        created_map = Map.objects.get(id=response.data['id'])
        self.assertEqual(created_map.created_by, self.owner)
        self.assertFalse(created_map.is_builtin)


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
