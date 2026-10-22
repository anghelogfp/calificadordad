from rest_framework import serializers
from .models import (
    DniCorrection,
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


# En las hojas de respuestas cada espacio es un dato (pregunta en blanco). DRF recorta por
# defecto los espacios de los CharField, lo que desplazaría las respuestas al guardarlas.
PRESERVE_WHITESPACE = {'trim_whitespace': False}


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
            'fecha_inscripcion',
            'codigo_programa',
            'dni',
            'paterno',
            'materno',
            'nombres',
            'observaciones',
            'area',
            'programa',
            'codigo_modalidad',
            'modalidad',
            'sexo',
            'fecha_nacimiento',
            'edad',
            'ubigeo_residencia',
            'departamento_residencia',
            'provincia_residencia',
            'distrito_residencia',
            'egreso',
            'codigo_modular',
            'ubigeo_colegio',
            'departamento_colegio',
            'provincia_colegio',
            'distrito_colegio',
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
    rawLine = serializers.CharField(source='raw_line', allow_blank=True, required=False, trim_whitespace=False)
    examCode = serializers.CharField(source='exam_code', allow_blank=True, required=False)
    sourceId = serializers.CharField(source='source_client_id', allow_blank=True, required=False)

    class Meta:
        model = IdentifierRow
        extra_kwargs = {'answers': PRESERVE_WHITESPACE}
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
        extra_kwargs = {'answers': PRESERVE_WHITESPACE}
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
        extra_kwargs = {'answers': PRESERVE_WHITESPACE}
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


class DniCorrectionSerializer(serializers.ModelSerializer):
    """Valida contra los datos del propio usuario; el DNI original lo deriva el servidor."""
    correctedDni = serializers.RegexField(r'^\d{8}$', source='corrected_dni')
    originalDni = serializers.CharField(source='original_dni', read_only=True)
    confirmedAt = serializers.DateTimeField(source='confirmed_at', read_only=True)

    class Meta:
        model = DniCorrection
        fields = ['id', 'litho', 'originalDni', 'correctedDni', 'confirmedAt']
        read_only_fields = ['id']

    def validate(self, attrs):
        user = self.context['request'].user
        litho = attrs['litho'].strip()
        corrected_dni = attrs['corrected_dni']

        sheet = ResponseRow.objects.filter(created_by=user, litho=litho).first()
        if sheet is None:
            raise serializers.ValidationError({'litho': 'La hoja no existe en las respuestas cargadas.'})

        padron_dnis = set(
            Candidato.objects.filter(created_by=user).values_list('dni', flat=True)
        )
        if corrected_dni not in padron_dnis:
            raise serializers.ValidationError({'correctedDni': 'El DNI no está en el padrón.'})
        if sheet.dni in padron_dnis:
            raise serializers.ValidationError({'litho': 'La hoja ya tiene un alumno en el padrón.'})
        if ResponseRow.objects.filter(created_by=user, dni=corrected_dni).exists():
            raise serializers.ValidationError({'correctedDni': 'Ese alumno ya tiene su propia hoja.'})

        active = DniCorrection.objects.filter(created_by=user, revoked_at__isnull=True)
        if active.filter(litho=litho).exists():
            raise serializers.ValidationError({'litho': 'La hoja ya tiene una corrección confirmada.'})
        if active.filter(corrected_dni=corrected_dni).exists():
            raise serializers.ValidationError({'correctedDni': 'Ese alumno ya fue asignado a otra hoja.'})

        attrs['litho'] = litho
        attrs['original_dni'] = sheet.dni
        return attrs
