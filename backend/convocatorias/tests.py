from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import (
    AnswerKeyRow,
    AnswerKeySource,
    Area,
    CalificationConfig,
    Candidato,
    DatFormatConfig,
    IdentifierRow,
    IdentifierSource,
    ProgramaVacante,
    ResponseRow,
    ResponseSource,
)


def candidate_payload(client_id='cand-1', dni='12345678'):
    return {
        'id': client_id,
        'dni': dni,
        'paterno': 'Paterno',
        'materno': 'Materno',
        'nombres': 'Nombre',
        'observaciones': '',
        'area': 'Ingeniería',
        'programa': 'Civil',
    }


def source_payload(client_id='source-1', name='archivo.dat'):
    return {
        'id': client_id,
        'name': name,
        'timestamp': '2026-07-01T12:00:00Z',
        'totalLines': 1,
        'validRows': 1,
        'errorCount': 0,
    }


def identifier_row_payload(client_id='row-1', source_id='source-1', dni='12345678'):
    return {
        'id': client_id,
        'rawLine': '',
        'header': '123',
        'lectura': '000001',
        'examCode': '2026',
        'folio': '77',
        'indicator': 'A',
        'litho': '654321',
        'tipo': 'P',
        'dni': dni,
        'aula': '101',
        'answers': '',
        'observaciones': 'Sin observaciones',
        'sourceId': source_id,
    }


def response_row_payload(client_id='response-1', source_id='source-1', dni='12345678'):
    return {
        'id': client_id,
        'header': '123',
        'lectura': '000001',
        'examCode': '2026',
        'folio': '77',
        'indicator': 'A',
        'litho': '654321',
        'tipo': 'P',
        'dni': dni,
        'answers': 'A' * 60,
        'observaciones': 'Sin observaciones',
        'sourceId': source_id,
    }


def answer_key_source_payload(client_id='key-source-1', name='claves.dat'):
    return {
        'id': client_id,
        'name': name,
        'identificationName': 'ids.dat',
        'timestamp': '2026-07-01T12:00:00Z',
        'area': 'Ingeniería',
        'scope': 'area',
        'validRows': 1,
        'responseErrors': 0,
        'identificationErrors': 0,
    }


def answer_key_row_payload(client_id='key-row-1', source_id='key-source-1'):
    return {
        'id': client_id,
        'area': 'Ingeniería',
        'tipo': 'P',
        'scope': 'area',
        'answers': 'A' * 60,
        'indicator': 'A',
        'folio': '77',
        'litho': '654321',
        'observaciones': 'Sin observaciones',
        'sourceId': source_id,
    }


class UserScopedDataTests(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user('user-a', password='test-pass-123')
        self.user_b = User.objects.create_user('user-b', password='test-pass-123')
        self.client = APIClient()

    def authenticate(self, user):
        self.client.force_authenticate(user)

    def test_candidatos_are_isolated_per_user_and_bulk_replace_only_replaces_current_user(self):
        Candidato.objects.create(created_by=self.user_b, client_id='b-cand', dni='87654321')

        self.authenticate(self.user_a)
        response = self.client.post(
            '/api/candidatos/bulk_replace/',
            {'rows': [candidate_payload('a-cand', '12345678')]},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Candidato.objects.filter(created_by=self.user_a).count(), 1)
        self.assertEqual(Candidato.objects.filter(created_by=self.user_b).count(), 1)
        self.assertEqual(response.data[0]['id'], 'a-cand')

        self.authenticate(self.user_b)
        list_response = self.client.get('/api/candidatos/')
        self.assertEqual([row['id'] for row in list_response.data], ['b-cand'])

    def test_identifier_bulk_replace_replaces_sources_and_rows_only_for_current_user(self):
        other_source = IdentifierSource.objects.create(
            created_by=self.user_b,
            client_id='b-source',
            name='b.dat',
            timestamp='2026-07-01T12:00:00Z',
        )
        IdentifierRow.objects.create(
            created_by=self.user_b,
            source=other_source,
            client_id='b-row',
            dni='87654321',
            source_client_id='b-source',
        )

        self.authenticate(self.user_a)
        response = self.client.post(
            '/api/identificadores/bulk_replace/',
            {
                'sources': [source_payload()],
                'rows': [identifier_row_payload()],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(IdentifierSource.objects.filter(created_by=self.user_a).count(), 1)
        self.assertEqual(IdentifierRow.objects.filter(created_by=self.user_a).count(), 1)
        self.assertEqual(IdentifierSource.objects.filter(created_by=self.user_b).count(), 1)
        self.assertEqual(IdentifierRow.objects.filter(created_by=self.user_b).count(), 1)
        self.assertEqual(IdentifierRow.objects.get(created_by=self.user_a).source.client_id, 'source-1')

    def test_response_bulk_replace_replaces_sources_and_rows_only_for_current_user(self):
        other_source = ResponseSource.objects.create(
            created_by=self.user_b,
            client_id='b-source',
            name='b.dat',
            timestamp='2026-07-01T12:00:00Z',
        )
        ResponseRow.objects.create(
            created_by=self.user_b,
            source=other_source,
            client_id='b-row',
            dni='87654321',
            source_client_id='b-source',
        )

        self.authenticate(self.user_a)
        response = self.client.post(
            '/api/respuestas/bulk_replace/',
            {
                'sources': [source_payload()],
                'rows': [response_row_payload()],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(ResponseSource.objects.filter(created_by=self.user_a).count(), 1)
        self.assertEqual(ResponseRow.objects.filter(created_by=self.user_a).count(), 1)
        self.assertEqual(ResponseSource.objects.filter(created_by=self.user_b).count(), 1)
        self.assertEqual(ResponseRow.objects.filter(created_by=self.user_b).count(), 1)
        self.assertEqual(ResponseRow.objects.get(created_by=self.user_a).source.client_id, 'source-1')

    def test_answer_key_bulk_replace_replaces_sources_and_rows_only_for_current_user(self):
        other_source = AnswerKeySource.objects.create(
            created_by=self.user_b,
            client_id='b-source',
            name='b.dat',
            timestamp='2026-07-01T12:00:00Z',
        )
        AnswerKeyRow.objects.create(
            created_by=self.user_b,
            source=other_source,
            client_id='b-row',
            area='Sociales',
            tipo='Q',
            answers='B' * 60,
            source_client_id='b-source',
        )

        self.authenticate(self.user_a)
        response = self.client.post(
            '/api/answer-keys/bulk_replace/',
            {
                'sources': [answer_key_source_payload()],
                'rows': [answer_key_row_payload()],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(AnswerKeySource.objects.filter(created_by=self.user_a).count(), 1)
        self.assertEqual(AnswerKeyRow.objects.filter(created_by=self.user_a).count(), 1)
        self.assertEqual(AnswerKeySource.objects.filter(created_by=self.user_b).count(), 1)
        self.assertEqual(AnswerKeyRow.objects.filter(created_by=self.user_b).count(), 1)
        self.assertEqual(AnswerKeyRow.objects.get(created_by=self.user_a).source.client_id, 'key-source-1')

    def test_programa_vacantes_bulk_replace_normalizes_values_and_isolates_users(self):
        ProgramaVacante.objects.create(created_by=self.user_b, programa='Civil', vacantes=9)

        self.authenticate(self.user_a)
        response = self.client.post(
            '/api/programa-vacantes/bulk_replace/',
            {'vacantes': {'Civil': '2', 'Sistemas': '-5', '': 10, 'Medicina': 'bad'}},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            dict(ProgramaVacante.objects.filter(created_by=self.user_a).values_list('programa', 'vacantes')),
            {'Civil': 2, 'Sistemas': 0, 'Medicina': 0},
        )
        self.assertEqual(ProgramaVacante.objects.get(created_by=self.user_b, programa='Civil').vacantes, 9)

    def test_calification_config_bulk_replace_replaces_only_current_user(self):
        CalificationConfig.objects.create(
            created_by=self.user_b,
            area='Ingeniería',
            correct_value=9,
            incorrect_value=0,
            blank_value=1,
        )

        self.authenticate(self.user_a)
        response = self.client.post(
            '/api/calification-configs/bulk_replace/',
            {
                'configs': [
                    {'area': 'Ingeniería', 'correctValue': 10, 'incorrectValue': -1, 'blankValue': 2},
                    {'area': '', 'correctValue': 1, 'incorrectValue': 1, 'blankValue': 1},
                    'invalid',
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(CalificationConfig.objects.filter(created_by=self.user_a).count(), 1)
        self.assertEqual(CalificationConfig.objects.filter(created_by=self.user_b).count(), 1)
        created = CalificationConfig.objects.get(created_by=self.user_a, area='Ingeniería')
        self.assertEqual(float(created.correct_value), 10.0)
        self.assertEqual(float(created.incorrect_value), -1.0)
        self.assertEqual(float(created.blank_value), 2.0)


class GlobalAreaAndDatFormatTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('regular-global', password='test-pass-123')
        self.admin = User.objects.create_user('admin-global', password='test-pass-123', is_staff=True)
        self.client = APIClient()

    def test_regular_user_can_read_but_not_write_areas(self):
        area = Area.objects.create(name='Ingeniería', question_count=60, vacantes=0, order=1)
        self.client.force_authenticate(self.user)

        list_response = self.client.get('/api/areas/')
        create_response = self.client.post(
            '/api/areas/',
            {'name': 'Privada', 'question_count': 60, 'vacantes': 0, 'order': 2},
            format='json',
        )
        update_response = self.client.patch(
            f'/api/areas/{area.id}/',
            {'question_count': 80},
            format='json',
        )
        delete_response = self.client.delete(f'/api/areas/{area.id}/')
        init_defaults_response = self.client.post('/api/areas/init_defaults/', {}, format='json')
        set_vacantes_response = self.client.patch(
            f'/api/areas/{area.id}/set_vacantes/',
            {'vacantes': 10},
            format='json',
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(create_response.status_code, 403)
        self.assertEqual(update_response.status_code, 403)
        self.assertEqual(delete_response.status_code, 403)
        self.assertEqual(init_defaults_response.status_code, 403)
        self.assertEqual(set_vacantes_response.status_code, 403)

    def test_admin_can_init_defaults_idempotently(self):
        Area.objects.create(name='Ingeniería', question_count=80, vacantes=5, order=99)
        self.client.force_authenticate(self.admin)

        first = self.client.post('/api/areas/init_defaults/', {}, format='json')
        second = self.client.post('/api/areas/init_defaults/', {}, format='json')

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(Area.objects.count(), 3)
        ingenieria = Area.objects.get(name='Ingeniería')
        self.assertEqual(ingenieria.question_count, 80)
        self.assertEqual(ingenieria.vacantes, 5)
        self.assertEqual(ingenieria.order, 99)
        self.assertEqual(
            list(Area.objects.order_by('order', 'name').values_list('name', flat=True)),
            ['Biomédicas', 'Sociales', 'Ingeniería'],
        )

    def test_admin_can_set_vacantes_and_validates_required_value(self):
        area = Area.objects.create(name='Ingeniería', question_count=60, vacantes=0, order=1)
        self.client.force_authenticate(self.admin)

        missing = self.client.patch(f'/api/areas/{area.id}/set_vacantes/', {}, format='json')
        updated = self.client.patch(f'/api/areas/{area.id}/set_vacantes/', {'vacantes': '12'}, format='json')

        self.assertEqual(missing.status_code, 400)
        self.assertEqual(missing.data['error'], 'vacantes es requerido')
        self.assertEqual(updated.status_code, 200)
        area.refresh_from_db()
        self.assertEqual(area.vacantes, 12)

    def test_dat_format_config_is_singleton_and_regular_user_can_only_read(self):
        self.client.force_authenticate(self.user)

        first = self.client.get('/api/dat-format-configs/')
        second = self.client.get('/api/dat-format-configs/')
        update = self.client.patch('/api/dat-format-configs/1/', {'answers_length': 80}, format='json')

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data['id'], 1)
        self.assertEqual(second.data['id'], 1)
        self.assertEqual(DatFormatConfig.objects.count(), 1)
        self.assertEqual(update.status_code, 403)

    def test_admin_updates_dat_format_singleton_even_if_missing(self):
        self.client.force_authenticate(self.admin)

        response = self.client.patch(
            '/api/dat-format-configs/1/',
            {
                'answers_length': 80,
                'litho_length': 7,
                'response_answers_offset': 9,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], 1)
        self.assertEqual(response.data['answers_length'], 80)
        self.assertEqual(response.data['litho_length'], 7)
        self.assertEqual(response.data['response_answers_offset'], 9)
        self.assertEqual(DatFormatConfig.objects.count(), 1)
