from rest_framework import serializers
from .models import AreaCalificacion, EventoBitacora, ProcesoCalificacion, ResultadoCandidato, VerificadorSesion


class ResultadoCandidatoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResultadoCandidato
        fields = [
            'id', 'dni', 'paterno', 'materno', 'nombres',
            'area', 'programa', 'score',
            'position', 'position_in_programa', 'is_ingresante',
            'answers_raw', 'correct_answers_raw',
            'aula', 'tipo', 'litho', 'cor_id',
        ]


class AreaCalificacionSerializer(serializers.ModelSerializer):
    resultados = ResultadoCandidatoSerializer(many=True, read_only=True)

    class Meta:
        model = AreaCalificacion
        fields = [
            'id', 'area', 'timestamp',
            'correct_value', 'incorrect_value', 'blank_value',
            'plantilla_id', 'plantilla_name', 'plantilla_snapshot',
            'total_candidates', 'missing_responses', 'missing_keys',
            'duplicate_responses', 'invalid_candidates', 'missing_programs',
            'invalid_response_types', 'unlinked_responses', 'no_calificados',
            'total_weight', 'answers_length',
            'preflight_snapshot', 'validation_snapshot', 'config_sha256',
            'resultados',
        ]


class ProcesoListSerializer(serializers.ModelSerializer):
    """Serializer liviano para el listado del historial."""
    area_names = serializers.ReadOnlyField()
    total_candidates = serializers.ReadOnlyField()
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = ProcesoCalificacion
        fields = [
            'id', 'local_id', 'name', 'process_type', 'simulacro_scope',
            'config_metadata',
            'area_names', 'total_candidates',
            'created_by_username', 'created_at', 'updated_at',
        ]


class ProcesoDetailSerializer(serializers.ModelSerializer):
    """Serializer completo con áreas y resultados."""
    areas_data = AreaCalificacionSerializer(source='areas', many=True, read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = ProcesoCalificacion
        fields = [
            'id', 'local_id', 'name', 'process_type', 'simulacro_scope',
            'config_metadata',
            'areas_data', 'created_by_username',
            'created_at', 'updated_at',
        ]


class VerificadorSesionSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = VerificadorSesion
        fields = [
            'id',
            'plantilla_id', 'plantilla_name', 'plantilla_snapshot',
            'proceso', 'dni', 'nombre', 'area', 'programa', 'aula', 'posicion', 'tipo_prueba',
            'answers', 'correct_answers',
            'correct_value', 'incorrect_value', 'blank_value',
            'score',
            'created_by_username', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class EventoBitacoraSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    proceso_local_id = serializers.CharField(source='proceso.local_id', read_only=True, default='')

    class Meta:
        model = EventoBitacora
        fields = [
            'id',
            'proceso',
            'proceso_local_id',
            'created_by_username',
            'timestamp',
            'categoria',
            'accion',
            'justificacion',
            'documento_sustento',
            'valor_anterior',
            'valor_nuevo',
        ]
        read_only_fields = ['id', 'created_by_username', 'proceso_local_id', 'timestamp']

    def to_internal_value(self, data):
        if isinstance(data, dict):
            normalized = dict(data)
            if 'documentoSustento' in normalized and 'documento_sustento' not in normalized:
                normalized['documento_sustento'] = normalized.pop('documentoSustento')
            if 'valorAnterior' in normalized and 'valor_anterior' not in normalized:
                normalized['valor_anterior'] = normalized.pop('valorAnterior')
            if 'valorNuevo' in normalized and 'valor_nuevo' not in normalized:
                normalized['valor_nuevo'] = normalized.pop('valorNuevo')

            request = self.context.get('request')
            user = getattr(request, 'user', None)
            raw_proceso = normalized.get('proceso')
            raw_local_id = normalized.get('proceso_local_id') or normalized.get('procesoLocalId')
            if user and user.is_authenticated:
                if raw_proceso is not None and not str(raw_proceso).isdigit():
                    proc = ProcesoCalificacion.objects.filter(
                        created_by=user, local_id=str(raw_proceso)
                    ).first()
                    normalized['proceso'] = proc.id if proc else None
                elif raw_proceso is None and raw_local_id:
                    proc = ProcesoCalificacion.objects.filter(
                        created_by=user, local_id=str(raw_local_id)
                    ).first()
                    normalized['proceso'] = proc.id if proc else None
                elif raw_proceso is not None and str(raw_proceso).isdigit():
                    proc = ProcesoCalificacion.objects.filter(
                        created_by=user, id=int(raw_proceso)
                    ).first()
                    if not proc:
                        raise serializers.ValidationError({'proceso': 'Proceso no encontrado para el usuario actual.'})
            data = normalized
        return super().to_internal_value(data)

