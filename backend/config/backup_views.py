from django.db import transaction
from django.utils.dateparse import parse_datetime
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from convocatorias.models import (
    AnswerKeyRow, AnswerKeySource, CalificationConfig, Candidato,
    DatFormatConfig, IdentifierRow, IdentifierSource, ProgramaVacante,
    ResponseRow, ResponseSource,
)
from convocatorias.serializers import (
    AnswerKeyRowSerializer, AnswerKeySourceSerializer, CalificationConfigSerializer,
    CandidatoSerializer, DatFormatConfigSerializer, IdentifierRowSerializer,
    IdentifierSourceSerializer, ProgramaVacanteSerializer, ResponseRowSerializer,
    ResponseSourceSerializer,
)
from ponderaciones.models import PlantillaItem, PlantillaPonderacion
from ponderaciones.serializers import (
    PlantillaPonderacionSerializer,
    PlantillaPonderacionWriteSerializer,
)
from resultados.models import AreaCalificacion, EventoBitacora, ProcesoCalificacion, ResultadoCandidato
from resultados.serializers import EventoBitacoraSerializer


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
    bitacora = serializers.ListField(child=serializers.DictField(), required=False)
    eventosBitacora = serializers.ListField(child=serializers.DictField(), required=False)


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
    proceso_by_key = {}
    for payload in procesos:
        local_id = str(payload.get('id') or payload.get('local_id') or '').strip()
        name = str(payload.get('name') or '').strip()
        if not local_id or not name:
            raise serializers.ValidationError('Cada proceso requiere id y name.')
        raw_meta = (
            payload.get('configMetadata')
            if 'configMetadata' in payload
            else payload.get('config_metadata', {})
        )
        config_metadata = raw_meta if isinstance(raw_meta, dict) else {}
        proceso = ProcesoCalificacion.objects.create(
            created_by=user,
            local_id=local_id,
            name=name,
            process_type=payload.get('type') or payload.get('process_type') or 'simulacro',
            simulacro_scope=payload.get('simulacroScope') or payload.get('simulacro_scope') or '',
            config_metadata=config_metadata,
        )
        proceso_by_key[local_id] = proceso
        if payload.get('dbId') is not None:
            proceso_by_key[str(payload.get('dbId'))] = proceso

        for area_name, area_data in (payload.get('areas') or {}).items():
            summary = area_data.get('summary') or {}
            preflight_snapshot = (
                area_data.get('preflightSnapshot')
                or area_data.get('preflight_snapshot')
                or summary.get('preflightSnapshot')
                or summary.get('preflight_snapshot')
                or {}
            )
            validation_snapshot = (
                area_data.get('validationSnapshot')
                or area_data.get('validation_snapshot')
                or summary.get('validationSnapshot')
                or summary.get('validation_snapshot')
                or {}
            )
            config_sha256 = (
                area_data.get('configSha256')
                or area_data.get('config_sha256')
                or summary.get('configSha256')
                or summary.get('config_sha256')
                or ''
            )
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
                duplicate_responses=summary.get('duplicateResponses', 0),
                invalid_candidates=summary.get('invalidCandidates', 0),
                missing_programs=summary.get('missingPrograms', 0),
                invalid_response_types=summary.get('invalidResponseTypes', 0),
                unlinked_responses=summary.get('unlinkedResponses', 0),
                no_calificados=summary.get('noCalificados', []),
                total_weight=summary.get('totalWeight', 0),
                answers_length=summary.get('answersLength', 60),
                preflight_snapshot=preflight_snapshot if isinstance(preflight_snapshot, dict) else {},
                validation_snapshot=validation_snapshot if isinstance(validation_snapshot, dict) else {},
                config_sha256=str(config_sha256 or ''),
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
    return proceso_by_key


def _replace_bitacora(user, bitacora_items, proceso_by_key):
    EventoBitacora.objects.filter(created_by=user).delete()
    for item in bitacora_items:
        if not isinstance(item, dict):
            continue
        accion = str(item.get('accion') or '').strip()
        if not accion:
            continue
        proc_key = (
            item.get('proceso_local_id')
            or item.get('procesoLocalId')
            or item.get('proceso')
        )
        proceso_obj = proceso_by_key.get(str(proc_key)) if proc_key is not None else None
        ev = EventoBitacora.objects.create(
            created_by=user,
            proceso=proceso_obj,
            categoria=str(item.get('categoria') or 'GENERAL'),
            accion=accion,
            justificacion=str(item.get('justificacion') or ''),
            documento_sustento=str(
                item.get('documento_sustento')
                if 'documento_sustento' in item
                else item.get('documentoSustento', '')
            ),
            valor_anterior=(
                item.get('valor_anterior')
                if 'valor_anterior' in item
                else item.get('valorAnterior')
            ),
            valor_nuevo=(
                item.get('valor_nuevo')
                if 'valor_nuevo' in item
                else item.get('valorNuevo')
            ),
        )
        parsed_ts = parse_datetime(str(item.get('timestamp') or ''))
        if parsed_ts:
            EventoBitacora.objects.filter(pk=ev.pk).update(timestamp=parsed_ts)


def _serialize_process_full(proceso):
    areas = {}
    for area_obj in proceso.areas.prefetch_related('resultados').all():
        areas[area_obj.area] = {
            'preflightSnapshot': area_obj.preflight_snapshot,
            'validationSnapshot': area_obj.validation_snapshot,
            'configSha256': area_obj.config_sha256,
            'summary': {
                'area': area_obj.area,
                'timestamp': area_obj.timestamp.isoformat() if area_obj.timestamp else None,
                'totalCandidates': area_obj.total_candidates,
                'missingResponses': area_obj.missing_responses,
                'missingKeys': area_obj.missing_keys,
                'duplicateResponses': area_obj.duplicate_responses,
                'invalidCandidates': area_obj.invalid_candidates,
                'missingPrograms': area_obj.missing_programs,
                'invalidResponseTypes': area_obj.invalid_response_types,
                'unlinkedResponses': area_obj.unlinked_responses,
                'noCalificados': area_obj.no_calificados,
                'totalWeight': float(area_obj.total_weight),
                'answersLength': area_obj.answers_length,
                'correctValue': float(area_obj.correct_value),
                'incorrectValue': float(area_obj.incorrect_value),
                'blankValue': float(area_obj.blank_value),
                'plantillaId': area_obj.plantilla_id,
                'plantillaName': area_obj.plantilla_name,
                'plantillaSnapshot': area_obj.plantilla_snapshot,
                'preflightSnapshot': area_obj.preflight_snapshot,
                'validationSnapshot': area_obj.validation_snapshot,
                'configSha256': area_obj.config_sha256,
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
                    'answersRaw': r.answers_raw,
                    'correctAnswersRaw': r.correct_answers_raw,
                    'aula': r.aula,
                    'tipo': r.tipo,
                    'litho': r.litho,
                    'corId': r.cor_id,
                }
                for r in area_obj.resultados.all()
            ],
        }
    return {
        'id': proceso.local_id,
        'dbId': proceso.id,
        'name': proceso.name,
        'type': proceso.process_type,
        'simulacroScope': proceso.simulacro_scope,
        'configMetadata': proceso.config_metadata,
        'config_metadata': proceso.config_metadata,
        'savedAt': proceso.updated_at.isoformat(),
        'areas': areas,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_backup(request):
    user = request.user
    dat_config, _ = DatFormatConfig.objects.get_or_create(pk=1)
    procesos = ProcesoCalificacion.objects.filter(created_by=user).prefetch_related('areas__resultados')
    bitacora_qs = EventoBitacora.objects.filter(created_by=user).select_related('proceso', 'created_by')

    return Response({
        'candidatos': CandidatoSerializer(Candidato.objects.filter(created_by=user), many=True).data,
        'identifierSources': IdentifierSourceSerializer(IdentifierSource.objects.filter(created_by=user), many=True).data,
        'identificadores': IdentifierRowSerializer(IdentifierRow.objects.filter(created_by=user), many=True).data,
        'responseSources': ResponseSourceSerializer(ResponseSource.objects.filter(created_by=user), many=True).data,
        'respuestas': ResponseRowSerializer(ResponseRow.objects.filter(created_by=user), many=True).data,
        'answerKeySources': AnswerKeySourceSerializer(AnswerKeySource.objects.filter(created_by=user), many=True).data,
        'answerKeys': AnswerKeyRowSerializer(AnswerKeyRow.objects.filter(created_by=user), many=True).data,
        'programaVacantes': ProgramaVacanteSerializer(ProgramaVacante.objects.filter(created_by=user), many=True).data,
        'calificationConfigs': CalificationConfigSerializer(CalificationConfig.objects.filter(created_by=user), many=True).data,
        'datFormatConfig': DatFormatConfigSerializer(dat_config).data,
        'plantillas': PlantillaPonderacionSerializer(PlantillaPonderacion.objects.prefetch_related('items').all(), many=True).data,
        'procesos': [_serialize_process_full(p) for p in procesos],
        'bitacora': EventoBitacoraSerializer(bitacora_qs, many=True).data,
    }, status=status.HTTP_200_OK)


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

        proceso_by_key = _replace_processes(user, data.get('procesos', []))
        bitacora_items = (
            data.get('bitacora')
            if 'bitacora' in data
            else data.get('eventosBitacora', [])
        )
        _replace_bitacora(user, bitacora_items, proceso_by_key)

    return Response({'detail': 'Backup restaurado completamente.'}, status=status.HTTP_200_OK)

