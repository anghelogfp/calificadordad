from django.test import TestCase

# Create your tests here.
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from convocatorias.models import Candidato
from resultados.models import ProcesoCalificacion, VerificadorSesion


def process_payload(local_id='same-id', areas=None):
    return {
        'local_id': local_id,
        'name': 'Proceso de prueba',
        'areas': areas if areas is not None else {},
    }


def area_payload(timestamp='2026-06-22T12:00:00Z', results=None):
    return {
        'summary': {
            'timestamp': timestamp,
            'correctValue': 10,
            'incorrectValue': -1,
            'blankValue': 2,
            'plantillaId': 7,
            'plantillaName': 'Plantilla Test',
            'plantillaSnapshot': [{'subject': 'General', 'questionCount': 60, 'ponderation': 1}],
            'totalCandidates': 1,
            'missingResponses': 0,
            'missingKeys': 0,
            'duplicateResponses': 0,
            'invalidCandidates': 0,
            'missingPrograms': 0,
            'invalidResponseTypes': 0,
            'unlinkedResponses': 0,
            'noCalificados': [],
            'totalWeight': 60,
            'answersLength': 60,
        },
        'results': results if results is not None else [
            {
                'dni': '12345678',
                'paterno': 'Paterno',
                'materno': 'Materno',
                'nombres': 'Nombre',
                'area': 'Ingeniería',
                'programa': 'Civil',
                'score': 600,
                'position': 1,
                'positionInPrograma': 1,
                'isIngresante': True,
                'answersRaw': 'A' * 60,
                'correctAnswersRaw': 'A' * 60,
                'aula': '101',
                'tipo': 'P',
                'litho': '654321',
                'corId': '2026',
            },
        ],
    }


def verificador_payload(**overrides):
    payload = {
        'plantilla_id': 1,
        'plantilla_name': 'Plantilla',
        'plantilla_snapshot': [{'subject': 'General', 'questionCount': 60, 'ponderation': 1}],
        'proceso': 'Proceso',
        'dni': '12345678',
        'nombre': 'Nombre Completo',
        'area': 'Ingeniería',
        'programa': 'Civil',
        'aula': '101',
        'posicion': '1',
        'tipo_prueba': 'P',
        'answers': 'A' * 60,
        'correct_answers': 'A' * 60,
        'correct_value': '10.000',
        'incorrect_value': '0.000',
        'blank_value': '2.000',
        'score': '600.000',
    }
    payload.update(overrides)
    return payload


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

    def test_create_validates_required_fields_and_areas_shape(self):
        self.client.force_authenticate(self.user_a)

        missing_local_id = self.client.post('/api/procesos/', process_payload(local_id=''), format='json')
        missing_name = self.client.post(
            '/api/procesos/',
            {'local_id': 'x', 'name': '', 'areas': {}},
            format='json',
        )
        invalid_areas = self.client.post(
            '/api/procesos/',
            {'local_id': 'x', 'name': 'Proceso', 'areas': []},
            format='json',
        )

        self.assertEqual(missing_local_id.status_code, 400)
        self.assertEqual(missing_name.status_code, 400)
        self.assertEqual(invalid_areas.status_code, 400)

    def test_full_returns_frontend_compatible_process_payload(self):
        self.client.force_authenticate(self.user_a)
        create = self.client.post(
            '/api/procesos/',
            process_payload(local_id='process-1', areas={'Ingeniería': area_payload()}),
            format='json',
        )
        proceso_id = create.data['id']

        response = self.client.get(f'/api/procesos/{proceso_id}/full/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], 'process-1')
        self.assertEqual(response.data['dbId'], proceso_id)
        self.assertEqual(response.data['type'], 'simulacro')
        self.assertIn('Ingeniería', response.data['areas'])
        area = response.data['areas']['Ingeniería']
        self.assertEqual(area['summary']['totalCandidates'], 1)
        self.assertEqual(area['summary']['correctValue'], 10.0)
        self.assertEqual(area['results'][0]['dni'], '12345678')
        self.assertEqual(area['results'][0]['score'], 600.0)
        self.assertTrue(area['results'][0]['isIngresante'])

    def test_process_retrieve_full_and_delete_are_isolated_per_user(self):
        self.client.force_authenticate(self.user_a)
        create = self.client.post(
            '/api/procesos/',
            process_payload(local_id='private-process', areas={'Ingeniería': area_payload()}),
            format='json',
        )
        proceso_id = create.data['id']

        self.client.force_authenticate(self.user_b)
        self.assertEqual(self.client.get(f'/api/procesos/{proceso_id}/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/procesos/{proceso_id}/full/').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/procesos/{proceso_id}/').status_code, 404)

        self.client.force_authenticate(self.user_a)
        self.assertEqual(self.client.delete(f'/api/procesos/{proceso_id}/').status_code, 204)
        self.assertFalse(ProcesoCalificacion.objects.filter(id=proceso_id).exists())

    def test_list_only_returns_current_user_processes(self):
        self.client.force_authenticate(self.user_a)
        self.client.post('/api/procesos/', process_payload(local_id='a-process'), format='json')

        self.client.force_authenticate(self.user_b)
        self.client.post('/api/procesos/', process_payload(local_id='b-process'), format='json')
        response = self.client.get('/api/procesos/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['local_id'] for row in response.data], ['b-process'])


class DniCorrectedMarkPersistenceTests(TestCase):
    """La marca de "DNI corregido" debe sobrevivir al historial y al backup."""

    def setUp(self):
        self.user = User.objects.create_user('marca-user', password='test-pass-123', is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def corrected_area(self):
        area = area_payload(results=[
            {
                'dni': '12345678', 'paterno': 'Normal', 'area': 'General', 'score': 600, 'position': 1,
                'answersRaw': 'A' * 60, 'correctAnswersRaw': 'A' * 60, 'litho': '100001',
                'dniCorregido': False, 'dniOriginal': '',
            },
            {
                'dni': '22222222', 'paterno': 'Corregido', 'area': 'General', 'score': 300, 'position': 2,
                'answersRaw': 'A' * 60, 'correctAnswersRaw': 'A' * 60, 'litho': '100002',
                'dniCorregido': True, 'dniOriginal': '22222229',
            },
        ])
        area['summary'].update({'sheetsWithoutCandidate': 3, 'dniCorrectionsApplied': 1})
        return area

    def assert_marks_round_trip(self, area):
        self.assertEqual(area['summary']['sheetsWithoutCandidate'], 3)
        self.assertEqual(area['summary']['dniCorrectionsApplied'], 1)
        by_dni = {row['dni']: row for row in area['results']}
        self.assertFalse(by_dni['12345678']['dniCorregido'])
        self.assertEqual(by_dni['12345678']['dniOriginal'], '')
        self.assertTrue(by_dni['22222222']['dniCorregido'])
        self.assertEqual(by_dni['22222222']['dniOriginal'], '22222229')

    def test_history_keeps_the_mark_and_summary_counts(self):
        create = self.client.post(
            '/api/procesos/',
            process_payload(local_id='marcado', areas={'General': self.corrected_area()}),
            format='json',
        )
        self.assertEqual(create.status_code, 201)

        full = self.client.get(f'/api/procesos/{create.data["id"]}/full/').data

        self.assert_marks_round_trip(full['areas']['General'])

    def test_saving_again_updates_the_mark(self):
        self.client.post('/api/procesos/', process_payload(local_id='marcado', areas={'General': self.corrected_area()}), format='json')
        without = self.corrected_area()
        for row in without['results']:
            row['dniCorregido'] = False
            row['dniOriginal'] = ''
        without['summary'].update({'sheetsWithoutCandidate': 4, 'dniCorrectionsApplied': 0})

        update = self.client.post('/api/procesos/', process_payload(local_id='marcado', areas={'General': without}), format='json')
        full = self.client.get(f'/api/procesos/{update.data["id"]}/full/').data['areas']['General']

        self.assertEqual(full['summary']['dniCorrectionsApplied'], 0)
        self.assertFalse(any(row['dniCorregido'] for row in full['results']))

    def test_results_without_the_fields_keep_working(self):
        """Resultados guardados por versiones anteriores no traen la marca."""
        create = self.client.post(
            '/api/procesos/', process_payload(local_id='viejo', areas={'Ingeniería': area_payload()}), format='json',
        )
        row = self.client.get(f'/api/procesos/{create.data["id"]}/full/').data['areas']['Ingeniería']['results'][0]

        self.assertFalse(row['dniCorregido'])
        self.assertEqual(row['dniOriginal'], '')

    def test_backup_restore_keeps_the_mark(self):
        payload = {'procesos': [{
            'id': 'restaurado', 'name': 'Restaurado', 'areas': {'General': self.corrected_area()},
        }]}

        self.assertEqual(self.client.post('/api/backup/restore/', payload, format='json').status_code, 200)

        proceso = ProcesoCalificacion.objects.get(created_by=self.user, local_id='restaurado')
        full = self.client.get(f'/api/procesos/{proceso.id}/full/').data
        self.assert_marks_round_trip(full['areas']['General'])


class VerificadorSesionTests(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user('verificador-a', password='test-pass-123')
        self.user_b = User.objects.create_user('verificador-b', password='test-pass-123')
        self.client = APIClient()

    def test_crud_and_created_by_are_set_from_authenticated_user(self):
        self.client.force_authenticate(self.user_a)

        create = self.client.post('/api/verificador/', verificador_payload(), format='json')
        self.assertEqual(create.status_code, 201)
        session_id = create.data['id']
        self.assertEqual(create.data['created_by_username'], 'verificador-a')
        self.assertEqual(VerificadorSesion.objects.get(id=session_id).created_by, self.user_a)

        update = self.client.patch(
            f'/api/verificador/{session_id}/',
            {'nombre': 'Nombre Editado', 'score': '590.000'},
            format='json',
        )
        self.assertEqual(update.status_code, 200)
        self.assertEqual(update.data['nombre'], 'Nombre Editado')
        self.assertEqual(str(VerificadorSesion.objects.get(id=session_id).score), '590.000')

        retrieve = self.client.get(f'/api/verificador/{session_id}/')
        self.assertEqual(retrieve.status_code, 200)
        self.assertEqual(retrieve.data['dni'], '12345678')

        delete = self.client.delete(f'/api/verificador/{session_id}/')
        self.assertEqual(delete.status_code, 204)
        self.assertFalse(VerificadorSesion.objects.filter(id=session_id).exists())

    def test_verificador_sessions_are_isolated_per_user(self):
        own = VerificadorSesion.objects.create(created_by=self.user_a, dni='11111111', nombre='A')
        other = VerificadorSesion.objects.create(created_by=self.user_b, dni='22222222', nombre='B')

        self.client.force_authenticate(self.user_a)
        list_response = self.client.get('/api/verificador/')
        self.assertEqual([row['id'] for row in list_response.data], [own.id])

        self.assertEqual(self.client.get(f'/api/verificador/{other.id}/').status_code, 404)
        self.assertEqual(
            self.client.patch(f'/api/verificador/{other.id}/', {'nombre': 'Hack'}, format='json').status_code,
            404,
        )
        self.assertEqual(self.client.delete(f'/api/verificador/{other.id}/').status_code, 404)
        other.refresh_from_db()
        self.assertEqual(other.nombre, 'B')


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

    def _correction(self, litho='000910', corrected='63737500'):
        from convocatorias.models import DniCorrection
        return DniCorrection.objects.create(
            created_by=self.admin, litho=litho, original_dni='63735500', corrected_dni=corrected,
        )

    def test_restore_recreates_dni_corrections_replacing_the_current_ones(self):
        from convocatorias.models import DniCorrection
        self._correction(litho='old-sheet', corrected='11111111')

        payload = {'dniCorrections': [{'litho': '000910', 'originalDni': '63735500', 'correctedDni': '63737500'}]}
        response = self.client.post('/api/backup/restore/', payload, format='json')

        self.assertEqual(response.status_code, 200)
        saved = DniCorrection.objects.filter(created_by=self.admin)
        self.assertEqual([(c.litho, c.original_dni, c.corrected_dni) for c in saved], [('000910', '63735500', '63737500')])
        self.assertTrue(all(c.revoked_at is None for c in saved))

    def test_backup_export_format_can_be_restored(self):
        from convocatorias.models import DniCorrection
        self._correction()
        exported = self.client.get('/api/correcciones-dni/').json()
        DniCorrection.objects.all().delete()

        response = self.client.post('/api/backup/restore/', {'dniCorrections': exported}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(DniCorrection.objects.filter(created_by=self.admin).count(), 1)

    def test_invalid_corrections_are_rejected_without_replacing_anything(self):
        from convocatorias.models import DniCorrection
        self._correction()
        bad_payloads = [
            {'dniCorrections': [{'litho': '000910', 'correctedDni': '123'}]},
            {'dniCorrections': [
                {'litho': '000910', 'correctedDni': '63737500'},
                {'litho': '000910', 'correctedDni': '11111111'},
            ]},
            {'dniCorrections': [
                {'litho': 'a', 'correctedDni': '63737500'},
                {'litho': 'b', 'correctedDni': '63737500'},
            ]},
        ]
        for payload in bad_payloads:
            response = self.client.post(
                '/api/backup/restore/', {**payload, 'candidatos': [{'id': 'replacement', 'dni': '87654321'}]}, format='json',
            )
            self.assertEqual(response.status_code, 400, payload)

        self.assertTrue(Candidato.objects.filter(created_by=self.admin, client_id='original').exists())
        self.assertEqual(DniCorrection.objects.get(created_by=self.admin).litho, '000910')

