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
            'candidatos': [{
                'id': 'replacement',
                'dni': '87654321',
                'cod_examen': 'E02a',
                'cod_puesto': '00301',
                'puesto': 'ESPECIALISTA JUDICIAL',
                'unidad': 'PUNO',
                'grupo': 'Grupo 1',
                'aula_padron': 'A18',
            }],
            'identifierSources': [{
                'id': 'src-1',
                'name': 'ide.dat',
                'timestamp': '2026-07-01T12:00:00Z',
                'totalLines': 10,
                'validRows': 10,
                'errorCount': 0,
                'sha256': 'abc12345',
                'fileSize': 512,
            }],
            'identificadores': [],
            'procesos': [{
                'id': 'restored-process',
                'name': 'Restaurado PJ',
                'type': 'poder_judicial',
                'configMetadata': {'rar_sha256': 'eee7604f', 'question_exceptions': [{'questionNumber': 14}]},
                'areas': {
                    'E02a': {
                        'preflightSnapshot': {'ok': True},
                        'validationSnapshot': {'valid': True},
                        'configSha256': '1157033efdf632a7',
                        'summary': {'timestamp': '2026-06-22T12:00:00Z', 'answersLength': 30},
                        'results': [],
                    },
                },
            }],
            'bitacora': [{
                'proceso': 'restored-process',
                'categoria': 'EXCEPCION_PREGUNTA',
                'accion': 'Anulación de pregunta 14 en E02a',
                'justificacion': 'Error tipográfico',
                'documentoSustento': 'Acta 01-PJ',
                'valorAnterior': {'type': 'NONE'},
                'valorNuevo': {'type': 'ANULADA_OTORGAR'},
            }],
        }
        response = self.client.post('/api/backup/restore/', payload, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertFalse(Candidato.objects.filter(created_by=self.admin, client_id='original').exists())
        cand = Candidato.objects.get(created_by=self.admin, client_id='replacement')
        self.assertEqual(cand.cod_examen, 'E02a')
        self.assertEqual(cand.aula_padron, 'A18')
        proc = ProcesoCalificacion.objects.get(created_by=self.admin, local_id='restored-process')
        self.assertEqual(proc.process_type, 'poder_judicial')
        self.assertEqual(proc.config_metadata['rar_sha256'], 'eee7604f')
        area_obj = proc.areas.get(area='E02a')
        self.assertEqual(area_obj.config_sha256, '1157033efdf632a7')
        self.assertEqual(area_obj.preflight_snapshot, {'ok': True})

        export_res = self.client.get('/api/backup/export/')
        self.assertEqual(export_res.status_code, 200)
        self.assertEqual(len(export_res.data['bitacora']), 1)
        self.assertEqual(export_res.data['bitacora'][0]['categoria'], 'EXCEPCION_PREGUNTA')
        self.assertEqual(export_res.data['identifierSources'][0]['sha256'], 'abc12345')


class PoderJudicialMetadataAndBitacoraTests(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user('pj-user-a', password='test-pass-123')
        self.user_b = User.objects.create_user('pj-user-b', password='test-pass-123')
        self.client = APIClient()

    def test_proceso_stores_and_returns_config_metadata_and_area_snapshots(self):
        self.client.force_authenticate(self.user_a)
        area = area_payload()
        area['preflightSnapshot'] = {'isReady': True, 'mode': 'poder_judicial'}
        area['validationSnapshot'] = {'isValid': True, 'tiesCount': 2}
        area['configSha256'] = 'a' * 64

        payload = {
            **process_payload(local_id='pj-proc-1', areas={'E02a': area}),
            'type': 'poder_judicial',
            'configMetadata': {
                'padron_sha256': 'decf800172efcfdbbc15090eb5dbc67bebacd9303e3ef93a45cd4180db4dff92',
                'question_exceptions': [{'codExamen': 'E02a', 'questionNumber': 5, 'type': 'ANULADA_OTORGAR'}],
                'scoring_options': {'useMinPassingScore': True, 'minPassingScore': 18},
            },
        }
        create_res = self.client.post('/api/procesos/', payload, format='json')
        self.assertEqual(create_res.status_code, 201)
        proceso_id = create_res.data['id']

        full_res = self.client.get(f'/api/procesos/{proceso_id}/full/')
        self.assertEqual(full_res.status_code, 200)
        self.assertEqual(full_res.data['type'], 'poder_judicial')
        self.assertEqual(
            full_res.data['configMetadata']['padron_sha256'],
            'decf800172efcfdbbc15090eb5dbc67bebacd9303e3ef93a45cd4180db4dff92',
        )
        self.assertEqual(full_res.data['areas']['E02a']['configSha256'], 'a' * 64)
        self.assertEqual(full_res.data['areas']['E02a']['preflightSnapshot']['mode'], 'poder_judicial')
        self.assertEqual(full_res.data['areas']['E02a']['validationSnapshot']['tiesCount'], 2)

    def test_evento_bitacora_crud_and_isolation_by_user_and_proceso(self):
        self.client.force_authenticate(self.user_a)
        proc_res = self.client.post(
            '/api/procesos/',
            process_payload(local_id='pj-proc-bitacora'),
            format='json',
        )
        proc_db_id = proc_res.data['id']

        ev_res = self.client.post(
            '/api/bitacora/',
            {
                'proceso': 'pj-proc-bitacora',
                'categoria': 'ANULACION_POSTULANTE',
                'accion': 'Postulante DNI 44095837 anulado por comisión',
                'justificacion': 'Incumplimiento de directiva en aula A18',
                'documentoSustento': 'Acta Incidencia A18',
                'valorAnterior': {'status': 'ACTIVO'},
                'valorNuevo': {'status': 'ANULADO'},
            },
            format='json',
        )
        self.assertEqual(ev_res.status_code, 201)
        self.assertEqual(ev_res.data['proceso'], proc_db_id)
        self.assertEqual(ev_res.data['proceso_local_id'], 'pj-proc-bitacora')
        self.assertEqual(ev_res.data['documento_sustento'], 'Acta Incidencia A18')

        list_by_local = self.client.get('/api/bitacora/?proceso=pj-proc-bitacora')
        self.assertEqual(list_by_local.status_code, 200)
        self.assertEqual(len(list_by_local.data), 1)

        list_by_db_id = self.client.get(f'/api/bitacora/?proceso={proc_db_id}')
        self.assertEqual(list_by_db_id.status_code, 200)
        self.assertEqual(len(list_by_db_id.data), 1)

        self.client.force_authenticate(self.user_b)
        other_list = self.client.get('/api/bitacora/')
        self.assertEqual(other_list.status_code, 200)
        self.assertEqual(len(other_list.data), 0)

    def test_standalone_bootstrap_creates_default_admin_and_pj_template(self):
        from run_standalone import bootstrap_database
        from ponderaciones.models import PlantillaPonderacion

        bootstrap_database()
        self.assertTrue(User.objects.filter(username='admin', is_superuser=True).exists())
        plantilla = PlantillaPonderacion.objects.filter(name='Poder Judicial — 30 Preguntas').first()
        self.assertIsNotNone(plantilla)
        self.assertEqual(plantilla.question_total, 30)

