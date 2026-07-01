from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import PlantillaItem, PlantillaPonderacion, Ponderacion


def ponderacion_payload(area='Ingeniería', subject='Álgebra', question_count=3, ponderation='2.500', order=1):
    return {
        'area': area,
        'subject': subject,
        'question_count': question_count,
        'ponderation': ponderation,
        'order': order,
    }


def plantilla_payload(name='Plantilla Ingeniería', area='Ingeniería', items=None):
    return {
        'name': name,
        'area': area,
        'items': items if items is not None else [
            {'subject': 'Álgebra', 'question_count': 3, 'ponderation': '2.000', 'order': 1},
            {'subject': 'Geometría', 'question_count': 2, 'ponderation': '3.000', 'order': 2},
        ],
    }


class PonderacionPermissionAndBulkTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('regular', password='test-pass-123')
        self.admin = User.objects.create_user('admin', password='test-pass-123', is_staff=True)
        self.client = APIClient()

    def test_authenticated_user_can_read_but_not_write_ponderaciones(self):
        Ponderacion.objects.create(**ponderacion_payload())
        self.client.force_authenticate(self.user)

        list_response = self.client.get('/api/ponderaciones/')
        create_response = self.client.post('/api/ponderaciones/', ponderacion_payload(subject='Física'), format='json')
        bulk_response = self.client.post('/api/ponderaciones/bulk_create/', [ponderacion_payload()], format='json')

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(create_response.status_code, 403)
        self.assertEqual(bulk_response.status_code, 403)

    def test_admin_bulk_create_creates_and_updates_legacy_ponderaciones(self):
        Ponderacion.objects.create(**ponderacion_payload(subject='Álgebra', question_count=1, ponderation='1.000'))
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            '/api/ponderaciones/bulk_create/',
            [
                ponderacion_payload(subject='Álgebra', question_count=4, ponderation='4.500', order=2),
                ponderacion_payload(subject='Física', question_count=2, ponderation='3.250', order=3),
                {'area': '', 'subject': ''},
            ],
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(len(response.data['errors']), 1)
        algebra = Ponderacion.objects.get(area='Ingeniería', subject='Álgebra')
        self.assertEqual(algebra.question_count, 4)
        self.assertEqual(float(algebra.ponderation), 4.5)
        self.assertTrue(Ponderacion.objects.filter(area='Ingeniería', subject='Física').exists())

    def test_area_filter_and_areas_action(self):
        Ponderacion.objects.create(**ponderacion_payload(area='Ingeniería', subject='Álgebra'))
        Ponderacion.objects.create(**ponderacion_payload(area='Sociales', subject='Historia'))
        self.client.force_authenticate(self.user)

        filtered = self.client.get('/api/ponderaciones/?area=ingeniería')
        areas = self.client.get('/api/ponderaciones/areas/')

        self.assertEqual(filtered.status_code, 200)
        self.assertEqual([row['area'] for row in filtered.data], ['Ingeniería'])
        self.assertEqual(areas.status_code, 200)
        self.assertEqual(set(areas.data), {'Ingeniería', 'Sociales'})

    def test_bulk_create_requires_list(self):
        self.client.force_authenticate(self.admin)

        response = self.client.post('/api/ponderaciones/bulk_create/', {'area': 'Ingeniería'}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'Se espera una lista de ponderaciones')


class PlantillaPonderacionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('regular-plantilla', password='test-pass-123')
        self.admin = User.objects.create_user('admin-plantilla', password='test-pass-123', is_staff=True)
        self.client = APIClient()

    def test_authenticated_user_can_read_but_not_write_plantillas(self):
        PlantillaPonderacion.objects.create(name='General', area=None)
        self.client.force_authenticate(self.user)

        list_response = self.client.get('/api/plantillas/')
        create_response = self.client.post('/api/plantillas/', plantilla_payload(), format='json')

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(create_response.status_code, 403)

    def test_admin_creates_template_with_items_and_question_total(self):
        self.client.force_authenticate(self.admin)

        response = self.client.post('/api/plantillas/', plantilla_payload(), format='json')

        self.assertEqual(response.status_code, 201)
        plantilla = PlantillaPonderacion.objects.get(id=response.data['id'])
        self.assertEqual(plantilla.question_total, 5)
        self.assertEqual(plantilla.items.count(), 2)

        detail = self.client.get(f'/api/plantillas/{plantilla.id}/')
        self.assertEqual(detail.data['question_total'], 5)
        self.assertEqual([item['subject'] for item in detail.data['items']], ['Álgebra', 'Geometría'])

    def test_admin_updates_template_and_replaces_items(self):
        plantilla = PlantillaPonderacion.objects.create(name='Old', area='Ingeniería')
        PlantillaItem.objects.create(plantilla=plantilla, subject='Old item', question_count=10, ponderation='1.000', order=1)
        plantilla.update_question_total()
        self.client.force_authenticate(self.admin)

        response = self.client.put(
            f'/api/plantillas/{plantilla.id}/',
            plantilla_payload(
                name='Nueva',
                area='Sociales',
                items=[{'subject': 'Historia', 'question_count': 4, 'ponderation': '2.000', 'order': 1}],
            ),
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        plantilla.refresh_from_db()
        self.assertEqual(plantilla.name, 'Nueva')
        self.assertEqual(plantilla.area, 'Sociales')
        self.assertEqual(plantilla.question_total, 4)
        self.assertEqual(list(plantilla.items.values_list('subject', flat=True)), ['Historia'])

    def test_add_update_and_delete_item_recalculate_question_total(self):
        plantilla = PlantillaPonderacion.objects.create(name='Plantilla', area='Ingeniería')
        self.client.force_authenticate(self.admin)

        add = self.client.post(
            f'/api/plantillas/{plantilla.id}/items/',
            {'subject': 'Álgebra', 'question_count': 3, 'ponderation': '2.000', 'order': 1},
            format='json',
        )
        self.assertEqual(add.status_code, 201)
        plantilla.refresh_from_db()
        self.assertEqual(plantilla.question_total, 3)

        item_id = add.data['id']
        update = self.client.put(
            f'/api/plantillas/{plantilla.id}/items/{item_id}/',
            {'subject': 'Álgebra', 'question_count': 5, 'ponderation': '2.000', 'order': 1},
            format='json',
        )
        self.assertEqual(update.status_code, 200)
        plantilla.refresh_from_db()
        self.assertEqual(plantilla.question_total, 5)

        delete = self.client.delete(f'/api/plantillas/{plantilla.id}/items/{item_id}/')
        self.assertEqual(delete.status_code, 204)
        plantilla.refresh_from_db()
        self.assertEqual(plantilla.question_total, 0)

    def test_item_detail_returns_404_for_item_from_another_template(self):
        plantilla = PlantillaPonderacion.objects.create(name='Plantilla', area='Ingeniería')
        other = PlantillaPonderacion.objects.create(name='Otra', area='Ingeniería')
        item = PlantillaItem.objects.create(plantilla=other, subject='Álgebra', question_count=1, ponderation='1.000', order=1)
        self.client.force_authenticate(self.admin)

        response = self.client.put(
            f'/api/plantillas/{plantilla.id}/items/{item.id}/',
            {'subject': 'Hack', 'question_count': 5, 'ponderation': '1.000', 'order': 1},
            format='json',
        )

        self.assertEqual(response.status_code, 404)
        item.refresh_from_db()
        self.assertEqual(item.subject, 'Álgebra')

    def test_area_filter_returns_area_specific_and_global_templates(self):
        PlantillaPonderacion.objects.create(name='General', area=None)
        PlantillaPonderacion.objects.create(name='Ingeniería', area='Ingeniería')
        PlantillaPonderacion.objects.create(name='Sociales', area='Sociales')
        self.client.force_authenticate(self.user)

        response = self.client.get('/api/plantillas/?area=ingeniería')

        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['name'] for row in response.data], ['General', 'Ingeniería'])

    def test_migrate_from_ponderaciones_is_idempotent_and_recalculates_totals(self):
        Ponderacion.objects.create(**ponderacion_payload(area='Ingeniería', subject='Álgebra', question_count=3, order=2))
        Ponderacion.objects.create(**ponderacion_payload(area='Ingeniería', subject='Aritmética', question_count=2, order=1))
        Ponderacion.objects.create(**ponderacion_payload(area='Sociales', subject='Historia', question_count=4, order=1))
        self.client.force_authenticate(self.admin)

        first = self.client.post('/api/plantillas/migrate_from_ponderaciones/', {}, format='json')
        second = self.client.post('/api/plantillas/migrate_from_ponderaciones/', {}, format='json')

        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data['migrated'], 2)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(PlantillaPonderacion.objects.filter(name='UNAP — Ingeniería', area='Ingeniería').count(), 1)
        ingenieria = PlantillaPonderacion.objects.get(name='UNAP — Ingeniería')
        self.assertEqual(ingenieria.question_total, 5)
        self.assertEqual(list(ingenieria.items.values_list('subject', flat=True)), ['Aritmética', 'Álgebra'])

    def test_regular_user_cannot_modify_template_items_or_migrate(self):
        plantilla = PlantillaPonderacion.objects.create(name='Plantilla', area='Ingeniería')
        item = PlantillaItem.objects.create(plantilla=plantilla, subject='Álgebra', question_count=1, ponderation='1.000', order=1)
        self.client.force_authenticate(self.user)

        add = self.client.post(
            f'/api/plantillas/{plantilla.id}/items/',
            {'subject': 'Física', 'question_count': 1, 'ponderation': '1.000', 'order': 2},
            format='json',
        )
        update = self.client.put(
            f'/api/plantillas/{plantilla.id}/items/{item.id}/',
            {'subject': 'Hack', 'question_count': 9, 'ponderation': '1.000', 'order': 1},
            format='json',
        )
        delete = self.client.delete(f'/api/plantillas/{plantilla.id}/items/{item.id}/')
        migrate = self.client.post('/api/plantillas/migrate_from_ponderaciones/', {}, format='json')

        self.assertEqual(add.status_code, 403)
        self.assertEqual(update.status_code, 403)
        self.assertEqual(delete.status_code, 403)
        self.assertEqual(migrate.status_code, 403)
