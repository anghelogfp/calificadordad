from rest_framework import serializers
from .models import Area, DatFormatConfig


class AreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Area
        fields = ['id', 'name', 'question_count', 'vacantes', 'order']
        read_only_fields = ['id']


class DatFormatConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = DatFormatConfig
        fields = [
            'id', 'header_length', 'answers_length',
            'litho_offset', 'litho_length', 'tipo_offset', 'tipo_length',
            'dni_offset', 'dni_length', 'aula_offset', 'aula_length', 'answers_offset',
        ]
        read_only_fields = ['id']
