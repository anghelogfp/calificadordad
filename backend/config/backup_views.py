from django.db import transaction
from django.utils.dateparse import parse_datetime
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from convocatorias.models import (
    AnswerKeyRow, AnswerKeySource, CalificationConfig, Candidato,
    DatFormatConfig, IdentifierRow, IdentifierSource, ProgramaVacante,
    ResponseRow, ResponseSource,
)
from convocatorias.serializers import (
    AnswerKeyRowSerializer, AnswerKeySourceSerializer, CalificationConfigSerializer,
    CandidatoSerializer, IdentifierRowSerializer, IdentifierSourceSerializer,
    ResponseRowSerializer, ResponseSourceSerializer,
)
from ponderaciones.models import PlantillaItem, PlantillaPonderacion
from ponderaciones.serializers import PlantillaPonderacionWriteSerializer
from resultados.models import AreaCalificacion, ProcesoCalificacion, ResultadoCandidato


class BackupPayloadSerializer(serializers.Serializer):
    candidatos = CandidatoSerializer(many=True, required=False)
    identifierSources = IdentifierSourceSerializer(many=True, required=False)
    identificadores = IdentifierRowSerializer(many=True, required=False)
    responseSources = ResponseSourceSerializer(many=True, required=False)
    respuestas = ResponseRowSerializer(many=True, required=False)
    answerKeySources = AnswerKeySourceSerializer(many=True, required=False)
    answerKeys = AnswerKeyRowSerializer(many=True, required=False)
    programaVacantes = serializers.ListField(child=serializers.DictField(), required=False)
    calificationConfigs = CalificationConfigSerializer(many=True, required=False)
    datFormatConfig = serializers.DictField(required=False)
    plantillas = PlantillaPonderacionWriteSerializer(many=True, required=False)
    procesos = serializers.ListField(child=serializers.DictField(), required=False)


def _replace_sources(user, source_model, row_model, sources, rows):
    row_model.objects.filter(created_by=user).delete()
    source_model.objects.filter(created_by=user).delete()
    source_objects = [source_model(created_by=user, **item) for item in sources]
    source_model.objects.bulk_create(source_objects)
    source_by_id = {source.client_id: source for source in source_objects}
    row_objects = []
    for item in rows:
        source_client_id = item.get('source_client_id', '')
        row_objects.append(row_model(
            created_by=user,
            source=source_by_id.get(source_client_id),
            **item,
        ))
    row_model.objects.bulk_create(row_objects)


def _replace_processes(user, procesos):
    ProcesoCalificacion.objects.filter(created_by=user).delete()
    for payload in procesos:
        local_id = str(payload.get('id') or payload.get('local_id') or '').strip()
        name = str(payload.get('name') or '').strip()
        if not local_id or not name:
            raise serializers.ValidationError('Cada proceso requiere id y name.')
        proceso = ProcesoCalificacion.objects.create(
            created_by=user, local_id=local_id, name=name,
        )
        for area_name, area_data in (payload.get('areas') or {}).items():
            summary = area_data.get('summary') or {}
            area_obj = AreaCalificacion.objects.create(
                proceso=proceso,
                area=area_name,
                timestamp=parse_datetime(summary.get('timestamp', '')) or proceso.created_at,
                correct_value=summary.get('correctValue', 10),
                incorrect_value=summary.get('incorrectValue', 0),
                blank_value=summary.get('blankValue', 2),
                plantilla_id=summary.get('plantillaId'),
                plantilla_name=summary.get('plantillaName', ''),
                plantilla_snapshot=summary.get('plantillaSnapshot', []),
                total_candidates=summary.get('totalCandidates', 0),
                missing_responses=summary.get('missingResponses', 0),
                missing_keys=summary.get('missingKeys', 0),
                total_weight=summary.get('totalWeight', 0),
                answers_length=summary.get('answersLength', 60),
            )
            ResultadoCandidato.objects.bulk_create([
                ResultadoCandidato(
                    area_result=area_obj,
                    dni=row.get('dni', ''), paterno=row.get('paterno', ''),
                    materno=row.get('materno', ''), nombres=row.get('nombres', ''),
                    area=row.get('area', area_name), programa=row.get('programa', ''),
                    score=row.get('score', 0), position=row.get('position', 0),
                    position_in_programa=row.get('positionInPrograma', 0),
                    is_ingresante=row.get('isIngresante', False),
                    answers_raw=row.get('answersRaw', ''),
                    correct_answers_raw=row.get('correctAnswersRaw', ''),
                    aula=row.get('aula', ''), tipo=row.get('tipo', ''),
                    litho=row.get('litho', ''), cor_id=row.get('corId', ''),
                ) for row in area_data.get('results', [])
            ])


@api_view(['POST'])
@permission_classes([IsAdminUser])
def restore_backup(request):
    serializer = BackupPayloadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    user = request.user

    with transaction.atomic():
        Candidato.objects.filter(created_by=user).delete()
        Candidato.objects.bulk_create([
            Candidato(created_by=user, **item) for item in data.get('candidatos', [])
        ])
        _replace_sources(user, IdentifierSource, IdentifierRow,
                         data.get('identifierSources', []), data.get('identificadores', []))
        _replace_sources(user, ResponseSource, ResponseRow,
                         data.get('responseSources', []), data.get('respuestas', []))
        _replace_sources(user, AnswerKeySource, AnswerKeyRow,
                         data.get('answerKeySources', []), data.get('answerKeys', []))

        ProgramaVacante.objects.filter(created_by=user).delete()
        ProgramaVacante.objects.bulk_create([
            ProgramaVacante(created_by=user, programa=str(row.get('programa', '')).strip(),
                            vacantes=max(0, int(row.get('vacantes', 0) or 0)))
            for row in data.get('programaVacantes', []) if str(row.get('programa', '')).strip()
        ])
        CalificationConfig.objects.filter(created_by=user).delete()
        CalificationConfig.objects.bulk_create([
            CalificationConfig(created_by=user, **item)
            for item in data.get('calificationConfigs', [])
        ])

        dat_config = data.get('datFormatConfig')
        if dat_config:
            dat_config.pop('id', None)
            DatFormatConfig.objects.update_or_create(pk=1, defaults=dat_config)

        PlantillaPonderacion.objects.all().delete()
        for plantilla_data in data.get('plantillas', []):
            items = plantilla_data.pop('items', [])
            plantilla = PlantillaPonderacion.objects.create(**plantilla_data)
            PlantillaItem.objects.bulk_create([
                PlantillaItem(plantilla=plantilla, **item) for item in items
            ])
            plantilla.update_question_total()

        _replace_processes(user, data.get('procesos', []))

    return Response({'detail': 'Backup restaurado completamente.'}, status=status.HTTP_200_OK)
