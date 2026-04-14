from rest_framework import serializers
from .models import AreaCalificacion, ProcesoCalificacion, ResultadoCandidato


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
            'total_weight', 'answers_length',
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
            'id', 'local_id', 'name',
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
            'id', 'local_id', 'name',
            'areas_data', 'created_by_username',
            'created_at', 'updated_at',
        ]
