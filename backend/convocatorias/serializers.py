from rest_framework import serializers
from .models import Convocatoria, Area, CalificationConfig, DatFormatConfig


class AreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Area
        fields = ['id', 'convocatoria', 'name', 'question_count', 'vacantes', 'order']
        read_only_fields = ['id']


class DatFormatConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = DatFormatConfig
        fields = [
            'id', 'convocatoria', 'header_length', 'answers_length',
            'litho_offset', 'litho_length', 'tipo_offset', 'tipo_length',
            'dni_offset', 'dni_length', 'aula_offset', 'aula_length', 'answers_offset'
        ]
        read_only_fields = ['id']


class CalificationConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalificationConfig
        fields = ['id', 'convocatoria', 'area_name', 'correct_value', 'incorrect_value', 'blank_value', 'updated_at']
        read_only_fields = ['id', 'updated_at']


class ConvocatoriaSerializer(serializers.ModelSerializer):
    areas = AreaSerializer(many=True, read_only=True)
    dat_format = DatFormatConfigSerializer(read_only=True)

    class Meta:
        model = Convocatoria
        fields = ['id', 'name', 'year', 'status', 'created_at', 'updated_at', 'areas', 'dat_format']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ConvocatoriaListSerializer(serializers.ModelSerializer):
    """Serializer ligero para listados sin datos anidados"""
    class Meta:
        model = Convocatoria
        fields = ['id', 'name', 'year', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
