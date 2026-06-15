from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import (
    Area,
    CalificationConfig,
    Candidato,
    DatFormatConfig,
    AnswerKeyRow,
    AnswerKeySource,
    IdentifierRow,
    IdentifierSource,
    ProgramaVacante,
    ResponseRow,
    ResponseSource,
)
from .serializers import (
    AreaSerializer,
    CalificationConfigSerializer,
    CandidatoSerializer,
    DatFormatConfigSerializer,
    AnswerKeyRowSerializer,
    AnswerKeySourceSerializer,
    IdentifierRowSerializer,
    IdentifierSourceSerializer,
    ProgramaVacanteSerializer,
    ResponseRowSerializer,
    ResponseSourceSerializer,
)

DEFAULT_AREAS = [
    {'name': 'Biomédicas', 'question_count': 60, 'vacantes': 0, 'order': 1},
    {'name': 'Sociales',   'question_count': 60, 'vacantes': 0, 'order': 2},
    {'name': 'Ingeniería', 'question_count': 60, 'vacantes': 0, 'order': 3},
]


class AreaViewSet(viewsets.ModelViewSet):
    serializer_class = AreaSerializer
    queryset = Area.objects.all()

    @action(detail=False, methods=['post'])
    def init_defaults(self, request):
        """Inicializa las áreas por defecto si no existen."""
        created = []
        for area_data in DEFAULT_AREAS:
            area, _ = Area.objects.get_or_create(
                name=area_data['name'],
                defaults={
                    'question_count': area_data['question_count'],
                    'vacantes': area_data['vacantes'],
                    'order': area_data['order'],
                },
            )
            created.append(AreaSerializer(area).data)
        return Response({'areas': created})

    @action(detail=True, methods=['patch'])
    def set_vacantes(self, request, pk=None):
        area = self.get_object()
        vacantes = request.data.get('vacantes')
        if vacantes is None:
            return Response({'error': 'vacantes es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        area.vacantes = int(vacantes)
        area.save()
        return Response(AreaSerializer(area).data)


class DatFormatConfigViewSet(viewsets.ModelViewSet):
    serializer_class = DatFormatConfigSerializer

    def get_queryset(self):
        return DatFormatConfig.objects.all()

    def list(self, request, *args, **kwargs):
        """Retorna el registro singleton (crea uno con defaults si no existe)."""
        config, _ = DatFormatConfig.objects.get_or_create(pk=1)
        return Response(DatFormatConfigSerializer(config).data)

    def update(self, request, *args, **kwargs):
        config, _ = DatFormatConfig.objects.get_or_create(pk=1)
        serializer = DatFormatConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class CandidatoViewSet(viewsets.ModelViewSet):
    """Padrón de postulantes del usuario autenticado."""
    serializer_class = CandidatoSerializer

    def get_queryset(self):
        return Candidato.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'])
    def bulk_replace(self, request):
        """Reemplaza el padrón completo del usuario actual."""
        rows = request.data.get('rows')
        if not isinstance(rows, list):
            return Response({'detail': 'rows debe ser una lista.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = CandidatoSerializer(data=rows, many=True)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            Candidato.objects.filter(created_by=request.user).delete()
            candidatos = [
                Candidato(created_by=request.user, **item)
                for item in serializer.validated_data
            ]
            Candidato.objects.bulk_create(candidatos)

        return Response(CandidatoSerializer(candidatos, many=True).data)


class IdentifierSourceViewSet(viewsets.ModelViewSet):
    """Archivos de identificación importados por el usuario autenticado."""
    serializer_class = IdentifierSourceSerializer

    def get_queryset(self):
        return IdentifierSource.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(created_by=self.request.user)


class IdentifierRowViewSet(viewsets.ModelViewSet):
    """Filas de identificación parseadas desde archivos .dat."""
    serializer_class = IdentifierRowSerializer

    def get_queryset(self):
        return IdentifierRow.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        source_id = serializer.validated_data.get('source_client_id', '')
        source = IdentifierSource.objects.filter(
            created_by=self.request.user,
            client_id=source_id,
        ).first() if source_id else None
        serializer.save(created_by=self.request.user, source=source)

    def perform_update(self, serializer):
        source_id = serializer.validated_data.get('source_client_id', '')
        source = IdentifierSource.objects.filter(
            created_by=self.request.user,
            client_id=source_id,
        ).first() if source_id else None
        serializer.save(created_by=self.request.user, source=source)

    @action(detail=False, methods=['post'])
    def bulk_replace(self, request):
        """Reemplaza fuentes y filas de identificadores del usuario actual."""
        rows = request.data.get('rows')
        sources = request.data.get('sources', [])
        if not isinstance(rows, list):
            return Response({'detail': 'rows debe ser una lista.'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(sources, list):
            return Response({'detail': 'sources debe ser una lista.'}, status=status.HTTP_400_BAD_REQUEST)

        source_serializer = IdentifierSourceSerializer(data=sources, many=True)
        source_serializer.is_valid(raise_exception=True)
        row_serializer = IdentifierRowSerializer(data=rows, many=True)
        row_serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            IdentifierRow.objects.filter(created_by=request.user).delete()
            IdentifierSource.objects.filter(created_by=request.user).delete()

            source_objs = []
            for item in source_serializer.validated_data:
                source_objs.append(IdentifierSource(created_by=request.user, **item))
            IdentifierSource.objects.bulk_create(source_objs)
            source_by_client_id = {source.client_id: source for source in source_objs}

            row_objs = []
            for item in row_serializer.validated_data:
                source_client_id = item.get('source_client_id', '')
                row_objs.append(IdentifierRow(
                    created_by=request.user,
                    source=source_by_client_id.get(source_client_id),
                    **item,
                ))
            IdentifierRow.objects.bulk_create(row_objs)

        return Response({
            'sources': IdentifierSourceSerializer(source_objs, many=True).data,
            'rows': IdentifierRowSerializer(row_objs, many=True).data,
        })


class ResponseSourceViewSet(viewsets.ModelViewSet):
    """Archivos de respuestas importados por el usuario autenticado."""
    serializer_class = ResponseSourceSerializer

    def get_queryset(self):
        return ResponseSource.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(created_by=self.request.user)


class ResponseRowViewSet(viewsets.ModelViewSet):
    """Filas de respuestas parseadas desde archivos .dat."""
    serializer_class = ResponseRowSerializer

    def get_queryset(self):
        return ResponseRow.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        source_id = serializer.validated_data.get('source_client_id', '')
        source = ResponseSource.objects.filter(
            created_by=self.request.user,
            client_id=source_id,
        ).first() if source_id else None
        serializer.save(created_by=self.request.user, source=source)

    def perform_update(self, serializer):
        source_id = serializer.validated_data.get('source_client_id', '')
        source = ResponseSource.objects.filter(
            created_by=self.request.user,
            client_id=source_id,
        ).first() if source_id else None
        serializer.save(created_by=self.request.user, source=source)

    @action(detail=False, methods=['post'])
    def bulk_replace(self, request):
        """Reemplaza fuentes y filas de respuestas del usuario actual."""
        rows = request.data.get('rows')
        sources = request.data.get('sources', [])
        if not isinstance(rows, list):
            return Response({'detail': 'rows debe ser una lista.'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(sources, list):
            return Response({'detail': 'sources debe ser una lista.'}, status=status.HTTP_400_BAD_REQUEST)

        source_serializer = ResponseSourceSerializer(data=sources, many=True)
        source_serializer.is_valid(raise_exception=True)
        row_serializer = ResponseRowSerializer(data=rows, many=True)
        row_serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            ResponseRow.objects.filter(created_by=request.user).delete()
            ResponseSource.objects.filter(created_by=request.user).delete()

            source_objs = []
            for item in source_serializer.validated_data:
                source_objs.append(ResponseSource(created_by=request.user, **item))
            ResponseSource.objects.bulk_create(source_objs)
            source_by_client_id = {source.client_id: source for source in source_objs}

            row_objs = []
            for item in row_serializer.validated_data:
                source_client_id = item.get('source_client_id', '')
                row_objs.append(ResponseRow(
                    created_by=request.user,
                    source=source_by_client_id.get(source_client_id),
                    **item,
                ))
            ResponseRow.objects.bulk_create(row_objs)

        return Response({
            'sources': ResponseSourceSerializer(source_objs, many=True).data,
            'rows': ResponseRowSerializer(row_objs, many=True).data,
        })


class AnswerKeySourceViewSet(viewsets.ModelViewSet):
    """Fuentes de claves oficiales importadas por el usuario autenticado."""
    serializer_class = AnswerKeySourceSerializer

    def get_queryset(self):
        return AnswerKeySource.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(created_by=self.request.user)


class AnswerKeyRowViewSet(viewsets.ModelViewSet):
    """Claves oficiales de respuestas."""
    serializer_class = AnswerKeyRowSerializer

    def get_queryset(self):
        return AnswerKeyRow.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        source_id = serializer.validated_data.get('source_client_id', '')
        source = AnswerKeySource.objects.filter(
            created_by=self.request.user,
            client_id=source_id,
        ).first() if source_id else None
        serializer.save(created_by=self.request.user, source=source)

    def perform_update(self, serializer):
        source_id = serializer.validated_data.get('source_client_id', '')
        source = AnswerKeySource.objects.filter(
            created_by=self.request.user,
            client_id=source_id,
        ).first() if source_id else None
        serializer.save(created_by=self.request.user, source=source)

    @action(detail=False, methods=['post'])
    def bulk_replace(self, request):
        """Reemplaza fuentes y filas de claves del usuario actual."""
        rows = request.data.get('rows')
        sources = request.data.get('sources', [])
        if not isinstance(rows, list):
            return Response({'detail': 'rows debe ser una lista.'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(sources, list):
            return Response({'detail': 'sources debe ser una lista.'}, status=status.HTTP_400_BAD_REQUEST)

        source_serializer = AnswerKeySourceSerializer(data=sources, many=True)
        source_serializer.is_valid(raise_exception=True)
        row_serializer = AnswerKeyRowSerializer(data=rows, many=True)
        row_serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            AnswerKeyRow.objects.filter(created_by=request.user).delete()
            AnswerKeySource.objects.filter(created_by=request.user).delete()

            source_objs = []
            for item in source_serializer.validated_data:
                source_objs.append(AnswerKeySource(created_by=request.user, **item))
            AnswerKeySource.objects.bulk_create(source_objs)
            source_by_client_id = {source.client_id: source for source in source_objs}

            row_objs = []
            for item in row_serializer.validated_data:
                source_client_id = item.get('source_client_id', '')
                row_objs.append(AnswerKeyRow(
                    created_by=request.user,
                    source=source_by_client_id.get(source_client_id),
                    **item,
                ))
            AnswerKeyRow.objects.bulk_create(row_objs)

        return Response({
            'sources': AnswerKeySourceSerializer(source_objs, many=True).data,
            'rows': AnswerKeyRowSerializer(row_objs, many=True).data,
        })


class ProgramaVacanteViewSet(viewsets.ModelViewSet):
    """Vacantes configuradas por programa de estudios para el usuario actual."""
    serializer_class = ProgramaVacanteSerializer

    def get_queryset(self):
        return ProgramaVacante.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'])
    def bulk_replace(self, request):
        """Reemplaza todas las vacantes por programa del usuario actual."""
        vacantes = request.data.get('vacantes')
        if not isinstance(vacantes, dict):
            return Response({'detail': 'vacantes debe ser un objeto.'}, status=status.HTTP_400_BAD_REQUEST)

        rows = []
        for programa, value in vacantes.items():
            programa = str(programa or '').strip()
            if not programa:
                continue
            try:
                count = int(value or 0)
            except (TypeError, ValueError):
                count = 0
            rows.append({'programa': programa, 'vacantes': max(0, count)})

        serializer = ProgramaVacanteSerializer(data=rows, many=True)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            ProgramaVacante.objects.filter(created_by=request.user).delete()
            objects = [
                ProgramaVacante(created_by=request.user, **item)
                for item in serializer.validated_data
            ]
            ProgramaVacante.objects.bulk_create(objects)

        return Response(ProgramaVacanteSerializer(objects, many=True).data)


class CalificationConfigViewSet(viewsets.ModelViewSet):
    """Valores de calificación por área para el usuario actual."""
    serializer_class = CalificationConfigSerializer

    def get_queryset(self):
        return CalificationConfig.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'])
    def bulk_replace(self, request):
        """Reemplaza toda la configuración de calificación del usuario actual."""
        configs = request.data.get('configs')
        if not isinstance(configs, list):
            return Response({'detail': 'configs debe ser una lista.'}, status=status.HTTP_400_BAD_REQUEST)

        cleaned = []
        for item in configs:
            if not isinstance(item, dict):
                continue
            area = str(item.get('area') or '').strip()
            if not area:
                continue
            cleaned.append({
                'area': area,
                'correctValue': item.get('correctValue', 10),
                'incorrectValue': item.get('incorrectValue', 0),
                'blankValue': item.get('blankValue', 2),
            })

        serializer = CalificationConfigSerializer(data=cleaned, many=True)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            CalificationConfig.objects.filter(created_by=request.user).delete()
            objects = [
                CalificationConfig(created_by=request.user, **item)
                for item in serializer.validated_data
            ]
            CalificationConfig.objects.bulk_create(objects)

        return Response(CalificationConfigSerializer(objects, many=True).data)
