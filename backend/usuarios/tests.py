from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient


class AuthEndpointTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='regular',
            password='test-pass-123',
            email='regular@example.com',
            first_name='Regular',
            last_name='User',
        )
        self.inactive = User.objects.create_user(
            username='inactive',
            password='test-pass-123',
            is_active=False,
        )
        self.client = APIClient()

    def test_login_returns_tokens_and_user_payload(self):
        response = self.client.post(
            '/api/auth/login/',
            {'username': 'regular', 'password': 'test-pass-123'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['username'], 'regular')
        self.assertEqual(response.data['user']['email'], 'regular@example.com')
        self.assertFalse(response.data['user']['is_staff'])

    def test_login_rejects_missing_or_invalid_credentials(self):
        missing = self.client.post('/api/auth/login/', {'username': ''}, format='json')
        wrong_password = self.client.post(
            '/api/auth/login/',
            {'username': 'regular', 'password': 'bad-password'},
            format='json',
        )
        unknown = self.client.post(
            '/api/auth/login/',
            {'username': 'unknown', 'password': 'test-pass-123'},
            format='json',
        )

        self.assertEqual(missing.status_code, 400)
        self.assertEqual(wrong_password.status_code, 401)
        self.assertEqual(unknown.status_code, 401)

    def test_login_rejects_inactive_user(self):
        response = self.client.post(
            '/api/auth/login/',
            {'username': 'inactive', 'password': 'test-pass-123'},
            format='json',
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['detail'], 'Cuenta desactivada.')

    def test_refresh_token_requires_valid_refresh_token(self):
        login = self.client.post(
            '/api/auth/login/',
            {'username': 'regular', 'password': 'test-pass-123'},
            format='json',
        )

        missing = self.client.post('/api/auth/refresh/', {}, format='json')
        invalid = self.client.post('/api/auth/refresh/', {'refresh': 'invalid-token'}, format='json')
        valid = self.client.post('/api/auth/refresh/', {'refresh': login.data['refresh']}, format='json')

        self.assertEqual(missing.status_code, 400)
        self.assertEqual(invalid.status_code, 401)
        self.assertEqual(valid.status_code, 200)
        self.assertIn('access', valid.data)

    def test_me_and_logout_require_authentication(self):
        unauth_me = self.client.get('/api/auth/me/')
        unauth_logout = self.client.post('/api/auth/logout/', {}, format='json')

        self.client.force_authenticate(self.user)
        auth_me = self.client.get('/api/auth/me/')
        auth_logout = self.client.post('/api/auth/logout/', {}, format='json')

        self.assertEqual(unauth_me.status_code, 401)
        self.assertEqual(unauth_logout.status_code, 401)
        self.assertEqual(auth_me.status_code, 200)
        self.assertEqual(auth_me.data['username'], 'regular')
        self.assertEqual(auth_logout.status_code, 200)
        self.assertEqual(auth_logout.data['detail'], 'Sesión cerrada.')


class UserAdministrationTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin',
            password='test-pass-123',
            is_staff=True,
        )
        self.regular = User.objects.create_user(
            username='regular',
            password='test-pass-123',
            email='regular@example.com',
        )
        self.superuser = User.objects.create_superuser(
            username='root',
            password='test-pass-123',
            email='root@example.com',
        )
        self.client = APIClient()

    def test_regular_user_cannot_access_user_admin_endpoints(self):
        self.client.force_authenticate(self.regular)

        list_response = self.client.get('/api/usuarios/')
        create_response = self.client.post(
            '/api/usuarios/',
            {'username': 'new-user', 'password': 'test-pass-123'},
            format='json',
        )
        update_response = self.client.patch(
            f'/api/usuarios/{self.regular.id}/',
            {'email': 'changed@example.com'},
            format='json',
        )
        password_response = self.client.post(
            f'/api/usuarios/{self.regular.id}/set-password/',
            {'password': 'new-pass-123'},
            format='json',
        )

        self.assertEqual(list_response.status_code, 403)
        self.assertEqual(create_response.status_code, 403)
        self.assertEqual(update_response.status_code, 403)
        self.assertEqual(password_response.status_code, 403)

    def test_admin_can_list_and_create_users(self):
        self.client.force_authenticate(self.admin)

        list_response = self.client.get('/api/usuarios/')
        create_response = self.client.post(
            '/api/usuarios/',
            {
                'username': 'created',
                'password': 'test-pass-123',
                'email': 'created@example.com',
                'first_name': 'Created',
                'last_name': 'User',
                'is_staff': True,
            },
            format='json',
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertIn('admin', [row['username'] for row in list_response.data])
        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.data['username'], 'created')
        self.assertTrue(create_response.data['is_staff'])
        self.assertTrue(User.objects.get(username='created').check_password('test-pass-123'))

    def test_admin_create_user_validates_required_and_duplicate_username(self):
        self.client.force_authenticate(self.admin)

        missing = self.client.post('/api/usuarios/', {'username': 'x'}, format='json')
        duplicate = self.client.post(
            '/api/usuarios/',
            {'username': 'regular', 'password': 'test-pass-123'},
            format='json',
        )

        self.assertEqual(missing.status_code, 400)
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(duplicate.data['detail'], 'El nombre de usuario ya existe.')

    def test_admin_can_update_regular_user(self):
        self.client.force_authenticate(self.admin)

        response = self.client.patch(
            f'/api/usuarios/{self.regular.id}/',
            {
                'username': 'regular-updated',
                'email': 'updated@example.com',
                'first_name': 'Updated',
                'last_name': 'Name',
                'is_staff': True,
                'is_active': False,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.regular.refresh_from_db()
        self.assertEqual(self.regular.username, 'regular-updated')
        self.assertEqual(self.regular.email, 'updated@example.com')
        self.assertTrue(self.regular.is_staff)
        self.assertFalse(self.regular.is_active)

    def test_admin_update_rejects_duplicate_username_and_missing_user(self):
        other = User.objects.create_user('other', password='test-pass-123')
        self.client.force_authenticate(self.admin)

        duplicate = self.client.patch(
            f'/api/usuarios/{self.regular.id}/',
            {'username': other.username},
            format='json',
        )
        missing = self.client.patch('/api/usuarios/999999/', {'email': 'x@example.com'}, format='json')

        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(duplicate.data['detail'], 'El nombre de usuario ya existe.')
        self.assertEqual(missing.status_code, 404)

    def test_staff_admin_cannot_edit_superuser(self):
        self.client.force_authenticate(self.admin)

        response = self.client.patch(
            f'/api/usuarios/{self.superuser.id}/',
            {'email': 'changed@example.com'},
            format='json',
        )

        self.assertEqual(response.status_code, 403)
        self.superuser.refresh_from_db()
        self.assertEqual(self.superuser.email, 'root@example.com')

    def test_superuser_can_edit_superuser(self):
        self.client.force_authenticate(self.superuser)

        response = self.client.patch(
            f'/api/usuarios/{self.superuser.id}/',
            {'email': 'changed@example.com'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.superuser.refresh_from_db()
        self.assertEqual(self.superuser.email, 'changed@example.com')

    def test_admin_can_set_password(self):
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            f'/api/usuarios/{self.regular.id}/set-password/',
            {'password': 'new-pass-456'},
            format='json',
        )
        empty = self.client.post(
            f'/api/usuarios/{self.regular.id}/set-password/',
            {'password': ''},
            format='json',
        )
        missing = self.client.post(
            '/api/usuarios/999999/set-password/',
            {'password': 'new-pass-456'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.regular.refresh_from_db()
        self.assertTrue(self.regular.check_password('new-pass-456'))
        self.assertEqual(empty.status_code, 400)
        self.assertEqual(missing.status_code, 404)
