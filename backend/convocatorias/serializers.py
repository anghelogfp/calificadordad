from rest_framework import serializers
from .models import (
    Area,
    CalificationConfig,
    Candidato,
    DatFormatConfig,
    IdentifierRow,
    IdentifierSource,
    AnswerKeyRow,
    AnswerKeySource,
    ProgramaVacante,
    ResponseRow,
    ResponseSource,
)


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
            'response_answers_offset',
        ]
        read_only_fields = ['id']


class CandidatoSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='client_id')

    class Meta:
        model = Candidato
        fields = [
            'id',
            'dni',
            'paterno',
            'materno',
            'nombres',
            'observaciones',
            'area',
            'programa',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class IdentifierSourceSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='client_id')
    totalLines = serializers.IntegerField(source='total_lines')
    validRows = serializers.IntegerField(source='valid_rows')
    errorCount = serializers.IntegerField(source='error_count')

    class Meta:
        model = IdentifierSource
        fields = [
            'id',
            'name',
            'timestamp',
            'totalLines',
            'validRows',
            'errorCount',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class IdentifierRowSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='client_id')
    rawLine = serializers.CharField(source='raw_line', allow_blank=True, required=False)
    examCode = serializers.CharField(source='exam_code', allow_blank=True, required=False)
    sourceId = serializers.CharField(source='source_client_id', allow_blank=True, required=False)

    class Meta:
        model = IdentifierRow
        fields = [
            'id',
            'rawLine',
            'header',
            'lectura',
            'examCode',
            'folio',
            'indicator',
            'litho',
            'tipo',
            'dni',
            'aula',
            'answers',
            'observaciones',
            'sourceId',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class ResponseSourceSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='client_id')
    totalLines = serializers.IntegerField(source='total_lines')
    validRows = serializers.IntegerField(source='valid_rows')
    errorCount = serializers.IntegerField(source='error_count')

    class Meta:
        model = ResponseSource
        fields = [
            'id',
            'name',
            'timestamp',
            'totalLines',
            'validRows',
            'errorCount',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class ResponseRowSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='client_id')
    examCode = serializers.CharField(source='exam_code', allow_blank=True, required=False)
    sourceId = serializers.CharField(source='source_client_id', allow_blank=True, required=False)

    class Meta:
        model = ResponseRow
        fields = [
            'id',
            'header',
            'lectura',
            'examCode',
            'folio',
            'indicator',
            'litho',
            'tipo',
            'dni',
            'answers',
            'observaciones',
            'sourceId',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class AnswerKeySourceSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='client_id')
    identificationName = serializers.CharField(source='identification_name', allow_blank=True, required=False)
    validRows = serializers.IntegerField(source='valid_rows')
    responseErrors = serializers.IntegerField(source='response_errors')
    identificationErrors = serializers.IntegerField(source='identification_errors')

    class Meta:
        model = AnswerKeySource
        fields = [
            'id',
            'name',
            'identificationName',
            'timestamp',
            'area',
            'scope',
            'validRows',
            'responseErrors',
            'identificationErrors',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class AnswerKeyRowSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='client_id')
    sourceId = serializers.CharField(source='source_client_id', allow_blank=True, required=False)

    class Meta:
        model = AnswerKeyRow
        fields = [
            'id',
            'area',
            'tipo',
            'scope',
            'answers',
            'indicator',
            'folio',
            'litho',
            'observaciones',
            'sourceId',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class ProgramaVacanteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgramaVacante
        fields = ['id', 'programa', 'vacantes', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class CalificationConfigSerializer(serializers.ModelSerializer):
    correctValue = serializers.DecimalField(source='correct_value', max_digits=8, decimal_places=3)
    incorrectValue = serializers.DecimalField(source='incorrect_value', max_digits=8, decimal_places=3)
    blankValue = serializers.DecimalField(source='blank_value', max_digits=8, decimal_places=3)

    class Meta:
        model = CalificationConfig
        fields = [
            'id',
            'area',
            'correctValue',
            'incorrectValue',
            'blankValue',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
