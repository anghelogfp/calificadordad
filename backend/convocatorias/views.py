from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import IntegrityError
from .models import Convocatoria, Area, CalificationConfig, DatFormatConfig
from .serializers import (
    ConvocatoriaSerializer,
    ConvocatoriaListSerializer,
    AreaSerializer,
    CalificationConfigSerializer,
    DatFormatConfigSerializer,
)


class ConvocatoriaViewSet(viewsets.ModelViewSet):
    queryset = Convocatoria.objects.all()

    def get_serializer_class(self):
        if self.action == 'list':
            return ConvocatoriaListSerializer
        return ConvocatoriaSerializer

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Retorna la convocatoria activa más reciente"""
        conv = Convocatoria.objects.filter(status=Convocatoria.STATUS_ACTIVE).first()
        if not conv:
            conv = Convocatoria.objects.first()
        if not conv:
            return Response(None)
        return Response(ConvocatoriaSerializer(conv).data)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Cierra una convocatoria"""
        conv = self.get_object()
        conv.status = Convocatoria.STATUS_CLOSED
        conv.save()
        return Response(ConvocatoriaListSerializer(conv).data)

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        """Reabre una convocatoria cerrada"""
        conv = self.get_object()
        conv.status = Convocatoria.STATUS_ACTIVE
        conv.save()
        return Response(ConvocatoriaListSerializer(conv).data)

    @action(detail=True, methods=['post'])
    def init_defaults(self, request, pk=None):
        """Inicializa áreas y formato DAT por defecto para la convocatoria"""
        conv = self.get_object()
        default_areas = request.data.get('areas', [
            {'name': 'Biomédicas', 'question_count': 60, 'vacantes': 0, 'order': 1},
            {'name': 'Sociales', 'question_count': 60, 'vacantes': 0, 'order': 2},
            {'name': 'Ingeniería', 'question_count': 60, 'vacantes': 0, 'order': 3},
        ])

        created_areas = []
        for area_data in default_areas:
            area, _ = Area.objects.get_or_create(
                convocatoria=conv,
                name=area_data['name'],
                defaults={
                    'question_count': area_data.get('question_count', 60),
                    'vacantes': area_data.get('vacantes', 0),
                    'order': area_data.get('order', 0),
                }
            )
            created_areas.append(AreaSerializer(area).data)

        # Crear formato DAT por defecto si no existe
        dat_format, _ = DatFormatConfig.objects.get_or_create(convocatoria=conv)

        return Response({
            'areas': created_areas,
            'dat_format': DatFormatConfigSerializer(dat_format).data,
        })


class AreaViewSet(viewsets.ModelViewSet):
    serializer_class = AreaSerializer

    def get_queryset(self):
        queryset = Area.objects.all()
        convocatoria_id = self.request.query_params.get('convocatoria')
        if convocatoria_id:
            queryset = queryset.filter(convocatoria_id=convocatoria_id)
        return queryset.order_by('order', 'name')

    @action(detail=True, methods=['patch'])
    def set_vacantes(self, request, pk=None):
        area = self.get_object()
        vacantes = request.data.get('vacantes')
        if vacantes is None:
            return Response({'error': 'vacantes es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        area.vacantes = int(vacantes)
        area.save()
        return Response(AreaSerializer(area).data)


class CalificationConfigViewSet(viewsets.ModelViewSet):
    serializer_class = CalificationConfigSerializer

    def get_queryset(self):
        queryset = CalificationConfig.objects.all()
        convocatoria_id = self.request.query_params.get('convocatoria')
        area_name = self.request.query_params.get('area')
        if convocatoria_id:
            queryset = queryset.filter(convocatoria_id=convocatoria_id)
        if area_name:
            queryset = queryset.filter(area_name__iexact=area_name)
        return queryset

    @action(detail=False, methods=['post'])
    def upsert(self, request):
        """Crea o actualiza una configuración de calificación"""
        convocatoria_id = request.data.get('convocatoria')
        area_name = request.data.get('area_name', '').strip()

        if not convocatoria_id or not area_name:
            return Response(
                {'error': 'convocatoria y area_name son requeridos'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            config, created = CalificationConfig.objects.update_or_create(
                convocatoria_id=convocatoria_id,
                area_name__iexact=area_name,
                defaults={
                    'area_name': area_name,
                    'correct_value': request.data.get('correct_value', 10),
                    'incorrect_value': request.data.get('incorrect_value', 0),
                    'blank_value': request.data.get('blank_value', 2),
                }
            )
            return Response(
                CalificationConfigSerializer(config).data,
                status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class DatFormatConfigViewSet(viewsets.ModelViewSet):
    serializer_class = DatFormatConfigSerializer

    def get_queryset(self):
        queryset = DatFormatConfig.objects.all()
        convocatoria_id = self.request.query_params.get('convocatoria')
        if convocatoria_id:
            queryset = queryset.filter(convocatoria_id=convocatoria_id)
        return queryset
