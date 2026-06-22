from django.test import TestCase

# Create your tests here.
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from convocatorias.models import Candidato
from resultados.models import ProcesoCalificacion


def process_payload(local_id='same-id', areas=None):
    return {
        'local_id': local_id,
        'name': 'Proceso de prueba',
        'areas': areas if areas is not None else {},
    }


class ProcessIsolationTests(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user('user-a', password='test-pass-123')
        self.user_b = User.objects.create_user('user-b', password='test-pass-123')
        self.client = APIClient()

    def test_same_local_id_is_isolated_per_user(self):
        self.client.force_authenticate(self.user_a)
        self.assertEqual(self.client.post('/api/procesos/', process_payload(), format='json').status_code, 201)

        self.client.force_authenticate(self.user_b)
        self.assertEqual(self.client.post('/api/procesos/', process_payload(), format='json').status_code, 201)

        self.assertEqual(ProcesoCalificacion.objects.filter(local_id='same-id').count(), 2)
        self.assertEqual(
            set(ProcesoCalificacion.objects.filter(local_id='same-id').values_list('created_by', flat=True)),
            {self.user_a.id, self.user_b.id},
        )

    def test_upsert_removes_areas_missing_from_payload(self):
        area = {
            'summary': {'timestamp': '2026-06-22T12:00:00Z'},
            'results': [],
        }
        self.client.force_authenticate(self.user_a)
        first = process_payload(areas={'Sociales': area, 'Ingeniería': area})
        self.assertEqual(self.client.post('/api/procesos/', first, format='json').status_code, 201)

        second = process_payload(areas={'Sociales': area})
        self.assertEqual(self.client.post('/api/procesos/', second, format='json').status_code, 201)
        proceso = ProcesoCalificacion.objects.get(created_by=self.user_a, local_id='same-id')
        self.assertEqual(list(proceso.areas.values_list('area', flat=True)), ['Sociales'])


class GlobalConfigurationPermissionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('regular', password='test-pass-123')
        self.admin = User.objects.create_user('admin', password='test-pass-123', is_staff=True)
        self.client = APIClient()

    def test_regular_user_can_read_but_not_create_global_area(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get('/api/areas/').status_code, 200)
        self.assertEqual(
            self.client.post('/api/areas/', {'name': 'Privada'}, format='json').status_code,
            403,
        )

    def test_admin_can_create_global_area(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(
            self.client.post('/api/areas/', {'name': 'Administrada'}, format='json').status_code,
            201,
        )


class BackupTransactionTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user('backup-admin', password='test-pass-123', is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        Candidato.objects.create(created_by=self.admin, client_id='original', dni='12345678')

    def test_invalid_process_rolls_back_prior_replacements(self):
        payload = {
            'candidatos': [{'id': 'replacement', 'dni': '87654321'}],
            'procesos': [{'id': 'missing-name', 'areas': {}}],
        }
        response = self.client.post('/api/backup/restore/', payload, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertTrue(Candidato.objects.filter(created_by=self.admin, client_id='original').exists())
        self.assertFalse(Candidato.objects.filter(created_by=self.admin, client_id='replacement').exists())

    def test_valid_backup_replaces_data_atomically(self):
        payload = {
            'candidatos': [{'id': 'replacement', 'dni': '87654321'}],
            'procesos': [{'id': 'restored-process', 'name': 'Restaurado', 'areas': {}}],
        }
        response = self.client.post('/api/backup/restore/', payload, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertFalse(Candidato.objects.filter(created_by=self.admin, client_id='original').exists())
        self.assertTrue(Candidato.objects.filter(created_by=self.admin, client_id='replacement').exists())
        self.assertTrue(ProcesoCalificacion.objects.filter(
            created_by=self.admin, local_id='restored-process'
        ).exists())
