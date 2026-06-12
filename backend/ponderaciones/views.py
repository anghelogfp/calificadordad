from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Ponderacion, PlantillaItem, PlantillaPonderacion
from .serializers import (
    PlantillaItemSerializer,
    PlantillaPonderacionSerializer,
    PlantillaPonderacionWriteSerializer,
    PonderacionSerializer,
)


class PonderacionViewSet(viewsets.ModelViewSet):
    queryset = Ponderacion.objects.all()
    serializer_class = PonderacionSerializer

    def get_queryset(self):
        queryset = Ponderacion.objects.all()
        area = self.request.query_params.get('area')
        if area:
            queryset = queryset.filter(area__iexact=area)
        return queryset.order_by('area', 'order', 'subject')

    @action(detail=False, methods=['get'])
    def areas(self, request):
        areas = Ponderacion.objects.values_list('area', flat=True).distinct()
        return Response(list(areas))

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        data = request.data
        if not isinstance(data, list):
            return Response(
                {'error': 'Se espera una lista de ponderaciones'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = []
        errors = []

        for item in data:
            serializer = PonderacionSerializer(data=item)
            if serializer.is_valid():
                existing = Ponderacion.objects.filter(
                    area__iexact=item.get('area', ''),
                    subject__iexact=item.get('subject', ''),
                ).first()
                if existing:
                    serializer = PonderacionSerializer(existing, data=item)
                    if serializer.is_valid():
                        serializer.save()
                        created.append(serializer.data)
                    else:
                        errors.append({'data': item, 'errors': serializer.errors})
                else:
                    serializer.save()
                    created.append(serializer.data)
            else:
                errors.append({'data': item, 'errors': serializer.errors})

        response_data = {'created': created, 'count': len(created)}
        if errors:
            response_data['errors'] = errors
        return Response(response_data, status=status.HTTP_201_CREATED)


class PlantillaPonderacionViewSet(viewsets.ModelViewSet):
    queryset = PlantillaPonderacion.objects.prefetch_related('items').all()

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return PlantillaPonderacionWriteSerializer
        return PlantillaPonderacionSerializer

    def get_queryset(self):
        qs = PlantillaPonderacion.objects.prefetch_related('items').all()
        area = self.request.query_params.get('area')
        if area:
            from django.db.models import Q
            qs = qs.filter(Q(area__iexact=area) | Q(area__isnull=True))
        return qs.order_by('area', 'name')

    @action(detail=True, methods=['post'], url_path='items')
    def add_item(self, request, pk=None):
        plantilla = self.get_object()
        serializer = PlantillaItemSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(plantilla=plantilla)
            plantilla.update_question_total()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['put', 'delete'], url_path=r'items/(?P<item_pk>[^/.]+)')
    def item_detail(self, request, pk=None, item_pk=None):
        plantilla = self.get_object()
        try:
            item = plantilla.items.get(pk=item_pk)
        except PlantillaItem.DoesNotExist:
            return Response({'error': 'Item no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        if request.method == 'DELETE':
            item.delete()
            plantilla.update_question_total()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = PlantillaItemSerializer(item, data=request.data)
        if serializer.is_valid():
            serializer.save()
            plantilla.update_question_total()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def migrate_from_ponderaciones(self, request):
        """Migra Ponderacion → PlantillaPonderacion. Idempotente."""
        from collections import defaultdict
        qs = Ponderacion.objects.all()
        groups = defaultdict(list)
        for pond in qs:
            groups[pond.area].append(pond)

        created_plantillas = []
        with transaction.atomic():
            for area, rows in groups.items():
                name = f'UNAP — {area}'
                plantilla, _ = PlantillaPonderacion.objects.get_or_create(
                    name=name, area=area, defaults={'question_total': 0},
                )
                plantilla.items.all().delete()
                for row in sorted(rows, key=lambda r: (r.order, r.subject)):
                    PlantillaItem.objects.create(
                        plantilla=plantilla,
                        subject=row.subject,
                        question_count=row.question_count,
                        ponderation=row.ponderation,
                        order=row.order,
                    )
                plantilla.update_question_total()
                created_plantillas.append(PlantillaPonderacionSerializer(plantilla).data)

        return Response({'migrated': len(created_plantillas), 'plantillas': created_plantillas})
