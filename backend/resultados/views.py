from django.db import transaction
from django.utils.dateparse import parse_datetime
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import AreaCalificacion, ProcesoCalificacion, ResultadoCandidato
from .serializers import ProcesoDetailSerializer, ProcesoListSerializer


class ProcesoCalificacionViewSet(viewsets.ModelViewSet):
    """
    CRUD de procesos de calificación.

    POST   /api/procesos/        → upsert por local_id (crea o actualiza)
    GET    /api/procesos/        → lista liviana para el historial
    GET    /api/procesos/{id}/   → detalle completo con resultados
    DELETE /api/procesos/{id}/   → eliminar
    GET    /api/procesos/{id}/full/ → formato compatible con el frontend
    """

    def get_queryset(self):
        return ProcesoCalificacion.objects.filter(
            created_by=self.request.user
        ).prefetch_related('areas__resultados')

    def get_serializer_class(self):
        if self.action in ('retrieve', 'create', 'update', 'partial_update'):
            return ProcesoDetailSerializer
        return ProcesoListSerializer

    def create(self, request):
        """
        Recibe la estructura completa del frontend y hace upsert por local_id.
        """
        data = request.data
        local_id = data.get('local_id', '').strip()
        name = data.get('name', '').strip()
        areas_payload = data.get('areas', {})
        convocatoria_id = data.get('convocatoria_id') or None

        if not local_id:
            return Response({'detail': 'local_id es requerido.'}, status=status.HTTP_400_BAD_REQUEST)
        if not name:
            return Response({'detail': 'name es requerido.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            proceso, _ = ProcesoCalificacion.objects.update_or_create(
                local_id=local_id,
                defaults={
                    'name': name,
                    'convocatoria_id': convocatoria_id,
                    'created_by': request.user,
                },
            )

            for area_name, area_data in areas_payload.items():
                summary = area_data.get('summary', {})
                results = area_data.get('results', [])

                area_obj, _ = AreaCalificacion.objects.update_or_create(
                    proceso=proceso,
                    area=area_name,
                    defaults={
                        'timestamp': parse_datetime(summary.get('timestamp', '')) or proceso.updated_at,
                        'correct_value': summary.get('correctValue', 10),
                        'incorrect_value': summary.get('incorrectValue', 0),
                        'blank_value': summary.get('blankValue', 2),
                        'plantilla_id': summary.get('plantillaId'),
                        'plantilla_name': summary.get('plantillaName', ''),
                        'plantilla_snapshot': summary.get('plantillaSnapshot', []),
                        'total_candidates': summary.get('totalCandidates', 0),
                        'missing_responses': summary.get('missingResponses', 0),
                        'missing_keys': summary.get('missingKeys', 0),
                        'total_weight': summary.get('totalWeight', 0),
                        'answers_length': summary.get('answersLength', 60),
                    },
                )

                area_obj.resultados.all().delete()
                ResultadoCandidato.objects.bulk_create([
                    ResultadoCandidato(
                        area_result=area_obj,
                        dni=r.get('dni', ''),
                        paterno=r.get('paterno', ''),
                        materno=r.get('materno', ''),
                        nombres=r.get('nombres', ''),
                        area=r.get('area', area_name),
                        programa=r.get('programa', ''),
                        score=r.get('score', 0),
                        position=r.get('position', 0),
                        position_in_programa=r.get('positionInPrograma', 0),
                        is_ingresante=r.get('isIngresante', False),
                    )
                    for r in results
                ])

        serializer = ProcesoDetailSerializer(proceso)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def full(self, request, pk=None):
        """Retorna el proceso en formato compatible con el frontend (activeProcess)."""
        proceso = self.get_object()
        areas = {}
        for area_obj in proceso.areas.prefetch_related('resultados').all():
            areas[area_obj.area] = {
                'summary': {
                    'area': area_obj.area,
                    'timestamp': area_obj.timestamp.isoformat() if area_obj.timestamp else None,
                    'totalCandidates': area_obj.total_candidates,
                    'missingResponses': area_obj.missing_responses,
                    'missingKeys': area_obj.missing_keys,
                    'totalWeight': float(area_obj.total_weight),
                    'answersLength': area_obj.answers_length,
                    'correctValue': float(area_obj.correct_value),
                    'incorrectValue': float(area_obj.incorrect_value),
                    'blankValue': float(area_obj.blank_value),
                    'plantillaId': area_obj.plantilla_id,
                    'plantillaName': area_obj.plantilla_name,
                    'plantillaSnapshot': area_obj.plantilla_snapshot,
                },
                'results': [
                    {
                        'id': f'{r.dni}-{r.area}',
                        'dni': r.dni,
                        'paterno': r.paterno,
                        'materno': r.materno,
                        'nombres': r.nombres,
                        'area': r.area,
                        'programa': r.programa,
                        'score': float(r.score),
                        'position': r.position,
                        'positionInPrograma': r.position_in_programa,
                        'isIngresante': r.is_ingresante,
                    }
                    for r in area_obj.resultados.all()
                ],
            }

        return Response({
            'id': proceso.local_id,
            'dbId': proceso.id,
            'name': proceso.name,
            'savedAt': proceso.updated_at.isoformat(),
            'areas': areas,
        })
