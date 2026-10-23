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
    DniCorrection,
    IdentifierRow,
    QuestionException,
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


def official_candidate_payload(client_id='official-1', dni='60759049'):
    return {
        **candidate_payload(client_id, dni),
        'fecha_inscripcion': '2026-01-06T12:46:38-05:00',
        'codigo_programa': '1',
        'codigo_modalidad': '9',
        'modalidad': 'CEPREUNA',
        'sexo': 'M',
        'fecha_nacimiento': '2006-07-12',
        'edad': 20,
        'ubigeo_residencia': '200101',
        'departamento_residencia': 'PUNO',
        'provincia_residencia': 'PUNO',
        'distrito_residencia': 'PUNO',
        'egreso': '2022',
        'codigo_modular': '0240267',
        'ubigeo_colegio': '200101',
        'departamento_colegio': 'PUNO',
        'provincia_colegio': 'PUNO',
        'distrito_colegio': 'PUNO',
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

    def test_candidate_bulk_replace_preserves_official_registry_fields(self):
        self.authenticate(self.user_a)
        response = self.client.post(
            '/api/candidatos/bulk_replace/',
            {'rows': [official_candidate_payload()]},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        candidate = Candidato.objects.get(created_by=self.user_a)
        self.assertEqual(candidate.codigo_programa, '1')
        self.assertEqual(candidate.modalidad, 'CEPREUNA')
        self.assertEqual(candidate.fecha_nacimiento.isoformat(), '2006-07-12')
        self.assertEqual(candidate.codigo_modular, '0240267')
        self.assertEqual(response.data[0]['ubigeo_residencia'], '200101')

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


class AnswerWhitespacePreservationTests(TestCase):
    """Los espacios de las respuestas son preguntas en blanco y deben guardarse tal cual."""

    # Blancos al inicio, en medio y al final: 60 posiciones exactas.
    SHEET = ' ' * 11 + 'BCDEA' * 8 + '   ' + 'E' + ' ' * 5

    def setUp(self):
        self.user = User.objects.create_user('blancos', password='test-pass-123')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_sheet_fixture_has_sixty_positions_with_edge_blanks(self):
        self.assertEqual(len(self.SHEET), 60)
        self.assertTrue(self.SHEET.startswith(' '))
        self.assertTrue(self.SHEET.endswith(' '))

    def test_response_answers_keep_leading_and_trailing_blanks(self):
        row = {**response_row_payload(), 'answers': self.SHEET}

        response = self.client.post(
            '/api/respuestas/bulk_replace/',
            {'sources': [source_payload()], 'rows': [row]},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(ResponseRow.objects.get().answers, self.SHEET)
        listed = self.client.get('/api/respuestas/').json()
        listed_rows = listed['results'] if isinstance(listed, dict) else listed
        self.assertEqual(listed_rows[0]['answers'], self.SHEET)

    def test_identifier_answers_and_raw_line_keep_blanks(self):
        raw_line = '  107000001001102126001   5330     1    N 000942P61703136101  '
        row = {**identifier_row_payload(), 'answers': self.SHEET, 'rawLine': raw_line}

        response = self.client.post(
            '/api/identificadores/bulk_replace/',
            {'sources': [source_payload()], 'rows': [row]},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        saved = IdentifierRow.objects.get()
        self.assertEqual(saved.answers, self.SHEET)
        self.assertEqual(saved.raw_line, raw_line)

    def test_answer_key_keeps_blanks(self):
        row = {**answer_key_row_payload(), 'answers': self.SHEET}

        response = self.client.post(
            '/api/answer-keys/bulk_replace/',
            {'sources': [answer_key_source_payload()], 'rows': [row]},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(AnswerKeyRow.objects.get().answers, self.SHEET)

    def test_every_answer_field_declared_by_the_serializers_preserves_whitespace(self):
        from .serializers import (
            AnswerKeyRowSerializer,
            IdentifierRowSerializer,
            ResponseRowSerializer,
        )

        for serializer_class in (IdentifierRowSerializer, ResponseRowSerializer, AnswerKeyRowSerializer):
            with self.subTest(serializer=serializer_class.__name__):
                field = serializer_class().fields['answers']
                self.assertFalse(field.trim_whitespace)
                self.assertEqual(field.run_validation(self.SHEET), self.SHEET)


class DniCorrectionTests(TestCase):
    """Confirmación de DNI sugeridos: valida contra los datos del usuario y conserva auditoría."""

    URL = '/api/correcciones-dni/'

    def setUp(self):
        self.user = User.objects.create_user('admin-corr', password='test-pass-123')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        # Padrón: el alumno real y otro que ya tiene su propia hoja.
        Candidato.objects.create(created_by=self.user, client_id='c1', dni='63737500', paterno='SUCAPUCA')
        Candidato.objects.create(created_by=self.user, client_id='c2', dni='11111111', paterno='OFICIAL')
        # Hoja con DNI mal marcado, y la hoja propia de 11111111.
        ResponseRow.objects.create(created_by=self.user, client_id='r1', litho='000910', dni='63735500')
        ResponseRow.objects.create(created_by=self.user, client_id='r2', litho='000001', dni='11111111')

    def post(self, litho='000910', corrected='63737500', **extra):
        return self.client.post(self.URL, {'litho': litho, 'correctedDni': corrected, **extra}, format='json')

    def test_confirms_a_correction_and_derives_original_dni_on_the_server(self):
        response = self.post(originalDni='99999999')

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body['litho'], '000910')
        self.assertEqual(body['correctedDni'], '63737500')
        self.assertEqual(body['originalDni'], '63735500')
        self.assertTrue(body['confirmedAt'])

    def test_confirming_does_not_change_the_sheet_or_the_padron(self):
        self.post()

        self.assertEqual(ResponseRow.objects.get(litho='000910').dni, '63735500')
        self.assertEqual(Candidato.objects.filter(dni='63737500').count(), 1)

    def test_rejects_a_dni_that_is_not_in_the_padron(self):
        response = self.post(corrected='99999999')
        self.assertEqual(response.status_code, 400)
        self.assertIn('correctedDni', response.json())

    def test_rejects_a_malformed_dni(self):
        for bad in ('6373750', '637375001', 'abcdefgh', ''):
            self.assertEqual(self.post(corrected=bad).status_code, 400, bad)

    def test_rejects_an_unknown_sheet(self):
        response = self.post(litho='999999')
        self.assertEqual(response.status_code, 400)
        self.assertIn('litho', response.json())

    def test_rejects_a_sheet_that_already_has_a_student_in_the_padron(self):
        response = self.post(litho='000001', corrected='63737500')
        self.assertEqual(response.status_code, 400)
        self.assertIn('litho', response.json())

    def test_rejects_a_student_who_already_has_their_own_sheet(self):
        response = self.post(corrected='11111111')
        self.assertEqual(response.status_code, 400)
        self.assertIn('correctedDni', response.json())

    def test_rejects_a_second_confirmation_for_the_same_sheet_or_student(self):
        self.assertEqual(self.post().status_code, 201)
        self.assertEqual(self.post().status_code, 400)

        ResponseRow.objects.create(created_by=self.user, client_id='r3', litho='000911', dni='63737400')
        other_sheet = self.post(litho='000911', corrected='63737500')
        self.assertEqual(other_sheet.status_code, 400)
        self.assertIn('correctedDni', other_sheet.json())

    def test_undo_revokes_but_keeps_the_audit_record(self):
        created = self.post().json()

        response = self.client.delete(f'{self.URL}{created["id"]}/')

        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.client.get(self.URL).json(), [])
        record = DniCorrection.objects.get(pk=created['id'])
        self.assertIsNotNone(record.revoked_at)
        self.assertEqual(record.corrected_dni, '63737500')

    def test_a_revoked_correction_can_be_confirmed_again(self):
        created = self.post().json()
        self.client.delete(f'{self.URL}{created["id"]}/')

        self.assertEqual(self.post().status_code, 201)
        self.assertEqual(DniCorrection.objects.count(), 2)
        self.assertEqual(len(self.client.get(self.URL).json()), 1)

    def test_corrections_are_isolated_per_user(self):
        created = self.post().json()
        other = User.objects.create_user('otro', password='test-pass-123')
        other_client = APIClient()
        other_client.force_authenticate(other)

        self.assertEqual(other_client.get(self.URL).json(), [])
        self.assertEqual(other_client.delete(f'{self.URL}{created["id"]}/').status_code, 404)
        self.assertIsNone(DniCorrection.objects.get(pk=created['id']).revoked_at)

        # Los datos de otro usuario no sirven para validar.
        denied = other_client.post(self.URL, {'litho': '000910', 'correctedDni': '63737500'}, format='json')
        self.assertEqual(denied.status_code, 400)

    def test_requires_authentication(self):
        anonymous = APIClient()
        self.assertEqual(anonymous.get(self.URL).status_code, 401)
        self.assertEqual(
            anonymous.post(self.URL, {'litho': '000910', 'correctedDni': '63737500'}, format='json').status_code,
            401,
        )


class SourceFileHashTests(TestCase):
    """Cada archivo cargado guarda su SHA-256 y tamaño, para poder demostrar con qué se calificó."""

    HASH = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    OTHER = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

    def setUp(self):
        self.user = User.objects.create_user('hash-user', password='test-pass-123')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def sources(self, url):
        listed = self.client.get(url).json()
        return listed['results'] if isinstance(listed, dict) else listed

    def test_identifier_and_response_sources_keep_hash_and_size(self):
        source = {**source_payload(), 'sha256': self.HASH, 'fileSize': 4321}
        for endpoint, row, listing in (
            ('/api/identificadores/bulk_replace/', identifier_row_payload(), '/api/identifier-sources/'),
            ('/api/respuestas/bulk_replace/', response_row_payload(), '/api/response-sources/'),
        ):
            response = self.client.post(endpoint, {'sources': [source], 'rows': [row]}, format='json')
            self.assertEqual(response.status_code, 200, endpoint)
            saved = self.sources(listing)[0]
            self.assertEqual(saved['sha256'], self.HASH)
            self.assertEqual(saved['fileSize'], 4321)

    def test_answer_key_source_keeps_both_file_hashes(self):
        source = {**answer_key_source_payload(), 'sha256': self.HASH, 'fileSize': 99, 'identificationSha256': self.OTHER}

        response = self.client.post(
            '/api/answer-keys/bulk_replace/', {'sources': [source], 'rows': [answer_key_row_payload()]}, format='json',
        )

        self.assertEqual(response.status_code, 200)
        saved = AnswerKeySource.objects.get()
        self.assertEqual((saved.sha256, saved.file_size, saved.identification_sha256), (self.HASH, 99, self.OTHER))
        listed = self.sources('/api/answer-key-sources/')[0]
        self.assertEqual(listed['identificationSha256'], self.OTHER)

    def test_clients_that_do_not_send_hashes_still_work(self):
        response = self.client.post(
            '/api/respuestas/bulk_replace/', {'sources': [source_payload()], 'rows': [response_row_payload()]}, format='json',
        )

        self.assertEqual(response.status_code, 200)
        saved = ResponseSource.objects.get()
        self.assertEqual((saved.sha256, saved.file_size), ('', 0))

    def test_an_unreadable_file_is_stored_without_a_hash(self):
        source = {**source_payload(), 'sha256': '', 'fileSize': 0}
        response = self.client.post(
            '/api/respuestas/bulk_replace/', {'sources': [source], 'rows': [response_row_payload()]}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(ResponseSource.objects.get().sha256, '')

    def test_rejects_values_that_are_not_a_sha256(self):
        for bad in ('xyz', self.HASH[:-1], self.HASH + '0', self.HASH.upper(), 'g' * 64):
            source = {**source_payload(), 'sha256': bad}
            response = self.client.post(
                '/api/respuestas/bulk_replace/', {'sources': [source], 'rows': [response_row_payload()]}, format='json',
            )
            self.assertEqual(response.status_code, 400, bad)
        self.assertEqual(ResponseSource.objects.count(), 0)

    def test_rejects_a_negative_size(self):
        source = {**source_payload(), 'fileSize': -1}
        response = self.client.post(
            '/api/identificadores/bulk_replace/', {'sources': [source], 'rows': [identifier_row_payload()]}, format='json',
        )
        self.assertEqual(response.status_code, 400)


class QuestionExceptionTests(TestCase):
    """Excepciones de pregunta: validadas contra las claves del usuario, ligadas a su contenido."""

    URL = '/api/excepciones-pregunta/'
    KEY = 'ABCDE' * 12

    def setUp(self):
        self.user = User.objects.create_user('exc-user', password='test-pass-123')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        AnswerKeyRow.objects.create(created_by=self.user, client_id='k-general', area='', tipo='P', answers=self.KEY)
        AnswerKeyRow.objects.create(created_by=self.user, client_id='k-ing-p', area='INGENIERÍAS', tipo='P', answers=self.KEY)
        AnswerKeyRow.objects.create(created_by=self.user, client_id='k-ing-q', area='INGENIERÍAS', tipo='Q', answers='EDCBA' * 12)

    def post(self, **overrides):
        payload = {
            'area': '', 'tipo': 'P', 'questionNumber': 5, 'type': 'ANULADA_OTORGAR',
            'reason': 'Pregunta mal formulada', 'documentRef': 'Acta 3', **overrides,
        }
        return self.client.post(self.URL, payload, format='json')

    def test_creates_an_exception_and_derives_the_key_hash_on_the_server(self):
        import hashlib
        response = self.post(keySha256='0' * 64)

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body['keySha256'], hashlib.sha256(self.KEY.encode()).hexdigest())
        self.assertEqual((body['questionNumber'], body['type'], body['documentRef']), (5, 'ANULADA_OTORGAR', 'Acta 3'))

    def test_the_hash_matches_the_frontend_test_vector(self):
        """sha256('ABC') es el mismo valor que fija la prueba del frontend (keyFingerprint)."""
        from convocatorias.serializers import key_fingerprint
        self.assertEqual(key_fingerprint('abc'), 'b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78')

    def test_each_key_has_its_own_exceptions(self):
        self.assertEqual(self.post(area='INGENIERÍAS', tipo='P').status_code, 201)
        self.assertEqual(self.post(area='INGENIERÍAS', tipo='Q').status_code, 201)
        self.assertEqual(self.post(area='').status_code, 201)
        hashes = {item['keySha256'] for item in self.client.get(self.URL).json()}
        self.assertEqual(len(hashes), 2)  # P y general comparten contenido; Q es distinta

    def test_the_type_of_letter_case_in_tipo_is_ignored(self):
        self.assertEqual(self.post(tipo='p').status_code, 201)
        self.assertEqual(QuestionException.objects.get().tipo, 'P')

    def test_rejects_an_exception_for_a_key_that_does_not_exist(self):
        for overrides in ({'area': 'SOCIALES'}, {'tipo': 'T'}):
            response = self.post(**overrides)
            self.assertEqual(response.status_code, 400, overrides)
            self.assertIn('area', response.json())

    def test_rejects_ambiguous_keys(self):
        AnswerKeyRow.objects.create(created_by=self.user, client_id='k-dup', area='', tipo='P', answers='EDCBA' * 12)
        response = self.post()
        self.assertEqual(response.status_code, 400)
        self.assertIn('más de una clave', response.json()['area'][0])

    def test_rejects_a_question_beyond_the_key(self):
        response = self.post(questionNumber=61)
        self.assertEqual(response.status_code, 400)
        self.assertIn('questionNumber', response.json())
        self.assertEqual(self.post(questionNumber=0).status_code, 400)

    def test_requires_a_reason(self):
        for reason in ('', '   '):
            response = self.post(reason=reason)
            self.assertEqual(response.status_code, 400, repr(reason))
            self.assertIn('reason', response.json())

    def test_multiple_key_needs_valid_letters_and_normalizes_them(self):
        self.assertEqual(self.post(type='CLAVE_MULTIPLE', validAnswers='').status_code, 400)
        self.assertEqual(self.post(type='CLAVE_MULTIPLE', validAnswers='xyz').status_code, 400)

        response = self.post(type='CLAVE_MULTIPLE', validAnswers='d, b b')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['validAnswers'], 'BD')

    def test_other_types_ignore_valid_answers(self):
        response = self.post(type='ANULADA_EXCLUIR', validAnswers='AB')
        self.assertEqual(response.json()['validAnswers'], '')

    def test_rejects_unknown_types(self):
        self.assertEqual(self.post(type='OTRA').status_code, 400)

    def test_rejects_a_second_exception_for_the_same_question_of_the_same_key(self):
        self.assertEqual(self.post().status_code, 201)
        response = self.post(type='ANULADA_EXCLUIR')
        self.assertEqual(response.status_code, 400)
        self.assertIn('ya tiene una excepción', response.json()['questionNumber'][0])

    def test_undo_revokes_keeps_the_audit_record_and_frees_the_question(self):
        created = self.post().json()

        self.assertEqual(self.client.delete(f'{self.URL}{created["id"]}/').status_code, 204)

        self.assertEqual(self.client.get(self.URL).json(), [])
        record = QuestionException.objects.get(pk=created['id'])
        self.assertIsNotNone(record.revoked_at)
        self.assertEqual(self.post().status_code, 201)
        self.assertEqual(QuestionException.objects.count(), 2)

    def test_exceptions_are_isolated_per_user(self):
        created = self.post().json()
        other = User.objects.create_user('otro-exc', password='test-pass-123')
        AnswerKeyRow.objects.create(created_by=other, client_id='k-otro', area='', tipo='P', answers=self.KEY)
        other_client = APIClient()
        other_client.force_authenticate(other)

        self.assertEqual(other_client.get(self.URL).json(), [])
        self.assertEqual(other_client.delete(f'{self.URL}{created["id"]}/').status_code, 404)
        self.assertIsNone(QuestionException.objects.get(pk=created['id']).revoked_at)
        # Cada usuario puede tener su propia excepción para su propia clave.
        self.assertEqual(
            other_client.post(self.URL, {'tipo': 'P', 'questionNumber': 5, 'type': 'ANULADA_OTORGAR', 'reason': 'x'}, format='json').status_code,
            201,
        )

    def test_requires_authentication(self):
        anonymous = APIClient()
        self.assertEqual(anonymous.get(self.URL).status_code, 401)
        self.assertEqual(anonymous.post(self.URL, {}, format='json').status_code, 401)

