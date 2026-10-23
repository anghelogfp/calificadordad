from django.db import models
from django.contrib.auth.models import User


class Area(models.Model):
    name = models.CharField(max_length=100, unique=True)
    question_count = models.IntegerField(default=60)
    vacantes = models.IntegerField(default=0)
    order = models.IntegerField(default=0)

    class Meta:
        db_table = 'areas'
        ordering = ['order', 'name']

    def __str__(self):
        return self.name


class DatFormatConfig(models.Model):
    """Singleton — configuración global del formato de archivos .dat."""
    header_length = models.IntegerField(default=21)
    answers_length = models.IntegerField(default=60)
    litho_offset = models.IntegerField(default=0)
    litho_length = models.IntegerField(default=6)
    tipo_offset = models.IntegerField(default=6)
    tipo_length = models.IntegerField(default=1)
    dni_offset = models.IntegerField(default=7)
    dni_length = models.IntegerField(default=8)
    aula_offset = models.IntegerField(default=15)
    aula_length = models.IntegerField(default=3)
    answers_offset = models.IntegerField(default=18)
    response_answers_offset = models.IntegerField(default=7)

    class Meta:
        db_table = 'dat_format_configs'

    def __str__(self):
        return 'Formato DAT global'


class Candidato(models.Model):
    """Fila del padrón de postulantes cargada por un usuario."""
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='candidatos_padron',
    )
    client_id = models.CharField(max_length=64)
    fecha_inscripcion = models.DateTimeField(null=True, blank=True)
    codigo_programa = models.CharField(max_length=20, blank=True)
    dni = models.CharField(max_length=20, blank=True)
    paterno = models.CharField(max_length=100, blank=True)
    materno = models.CharField(max_length=100, blank=True)
    nombres = models.CharField(max_length=200, blank=True)
    observaciones = models.CharField(max_length=300, blank=True)
    area = models.CharField(max_length=100, blank=True)
    programa = models.CharField(max_length=200, blank=True)
    codigo_modalidad = models.CharField(max_length=20, blank=True)
    modalidad = models.CharField(max_length=100, blank=True)
    sexo = models.CharField(max_length=10, blank=True)
    fecha_nacimiento = models.DateField(null=True, blank=True)
    edad = models.PositiveSmallIntegerField(null=True, blank=True)
    ubigeo_residencia = models.CharField(max_length=20, blank=True)
    departamento_residencia = models.CharField(max_length=100, blank=True)
    provincia_residencia = models.CharField(max_length=100, blank=True)
    distrito_residencia = models.CharField(max_length=100, blank=True)
    egreso = models.CharField(max_length=10, blank=True)
    codigo_modular = models.CharField(max_length=20, blank=True)
    ubigeo_colegio = models.CharField(max_length=20, blank=True)
    departamento_colegio = models.CharField(max_length=100, blank=True)
    provincia_colegio = models.CharField(max_length=100, blank=True)
    distrito_colegio = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'candidatos_padron'
        ordering = ['paterno', 'materno', 'nombres', 'dni']
        unique_together = [['created_by', 'client_id']]
        indexes = [
            models.Index(fields=['created_by', 'dni']),
            models.Index(fields=['created_by', 'area']),
            models.Index(fields=['created_by', 'programa']),
        ]

    def __str__(self):
        nombre = ' '.join(part for part in [self.paterno, self.materno, self.nombres] if part)
        return f'{self.dni} - {nombre or "Sin nombre"}'


class IdentifierSource(models.Model):
    """Archivo de identificación importado por un usuario."""
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='identifier_sources',
    )
    client_id = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    timestamp = models.DateTimeField()
    total_lines = models.IntegerField(default=0)
    valid_rows = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    sha256 = models.CharField(max_length=64, blank=True, default='')
    file_size = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'identifier_sources'
        ordering = ['-timestamp', 'name']
        unique_together = [['created_by', 'client_id']]
        indexes = [
            models.Index(fields=['created_by', 'timestamp']),
        ]

    def __str__(self):
        return f'{self.name} ({self.valid_rows} registros)'


class IdentifierRow(models.Model):
    """Fila parseada desde un archivo de identificación .dat."""
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='identifier_rows',
    )
    source = models.ForeignKey(
        IdentifierSource,
        on_delete=models.CASCADE,
        related_name='rows',
        null=True,
        blank=True,
    )
    client_id = models.CharField(max_length=64)
    raw_line = models.TextField(blank=True)
    header = models.CharField(max_length=80, blank=True)
    lectura = models.CharField(max_length=40, blank=True)
    exam_code = models.CharField(max_length=40, blank=True)
    folio = models.CharField(max_length=40, blank=True)
    indicator = models.CharField(max_length=10, blank=True)
    litho = models.CharField(max_length=40, blank=True)
    tipo = models.CharField(max_length=10, blank=True)
    dni = models.CharField(max_length=20, blank=True)
    aula = models.CharField(max_length=20, blank=True)
    answers = models.CharField(max_length=300, blank=True)
    observaciones = models.CharField(max_length=300, blank=True)
    source_client_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'identifier_rows'
        ordering = ['lectura', 'dni', 'client_id']
        unique_together = [['created_by', 'client_id']]
        indexes = [
            models.Index(fields=['created_by', 'dni']),
            models.Index(fields=['created_by', 'litho']),
            models.Index(fields=['created_by', 'source_client_id']),
        ]

    def __str__(self):
        return f'{self.lectura} - {self.dni or self.litho}'


class ResponseSource(models.Model):
    """Archivo de respuestas importado por un usuario."""
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='response_sources',
    )
    client_id = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    timestamp = models.DateTimeField()
    total_lines = models.IntegerField(default=0)
    valid_rows = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    sha256 = models.CharField(max_length=64, blank=True, default='')
    file_size = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'response_sources'
        ordering = ['-timestamp', 'name']
        unique_together = [['created_by', 'client_id']]
        indexes = [
            models.Index(fields=['created_by', 'timestamp']),
        ]

    def __str__(self):
        return f'{self.name} ({self.valid_rows} registros)'


class ResponseRow(models.Model):
    """Fila parseada desde una hoja de respuestas .dat."""
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='response_rows',
    )
    source = models.ForeignKey(
        ResponseSource,
        on_delete=models.CASCADE,
        related_name='rows',
        null=True,
        blank=True,
    )
    client_id = models.CharField(max_length=64)
    header = models.CharField(max_length=80, blank=True)
    lectura = models.CharField(max_length=40, blank=True)
    exam_code = models.CharField(max_length=40, blank=True)
    folio = models.CharField(max_length=40, blank=True)
    indicator = models.CharField(max_length=10, blank=True)
    litho = models.CharField(max_length=40, blank=True)
    tipo = models.CharField(max_length=10, blank=True)
    dni = models.CharField(max_length=20, blank=True)
    answers = models.CharField(max_length=300, blank=True)
    observaciones = models.CharField(max_length=300, blank=True)
    source_client_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'response_rows'
        ordering = ['lectura', 'dni', 'client_id']
        unique_together = [['created_by', 'client_id']]
        indexes = [
            models.Index(fields=['created_by', 'dni']),
            models.Index(fields=['created_by', 'litho']),
            models.Index(fields=['created_by', 'source_client_id']),
        ]

    def __str__(self):
        return f'{self.lectura} - {self.dni or self.litho}'


class AnswerKeySource(models.Model):
    """Par de archivos oficiales usado para importar claves de respuestas."""
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='answer_key_sources',
    )
    client_id = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    identification_name = models.CharField(max_length=255, blank=True)
    timestamp = models.DateTimeField()
    area = models.CharField(max_length=100, blank=True)
    scope = models.CharField(max_length=20, blank=True, default='')
    valid_rows = models.IntegerField(default=0)
    response_errors = models.IntegerField(default=0)
    identification_errors = models.IntegerField(default=0)
    sha256 = models.CharField(max_length=64, blank=True, default='')
    file_size = models.IntegerField(default=0)
    identification_sha256 = models.CharField(max_length=64, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'answer_key_sources'
        ordering = ['-timestamp', 'area', 'name']
        unique_together = [['created_by', 'client_id']]
        indexes = [
            models.Index(fields=['created_by', 'area']),
            models.Index(fields=['created_by', 'timestamp']),
        ]

    def __str__(self):
        return f'{self.area} - {self.name}'


class AnswerKeyRow(models.Model):
    """Clave oficial de respuestas para un área y tipo."""
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='answer_key_rows',
    )
    source = models.ForeignKey(
        AnswerKeySource,
        on_delete=models.CASCADE,
        related_name='rows',
        null=True,
        blank=True,
    )
    client_id = models.CharField(max_length=64)
    area = models.CharField(max_length=100, blank=True)
    tipo = models.CharField(max_length=10, blank=True)
    scope = models.CharField(max_length=20, blank=True, default='')
    answers = models.CharField(max_length=300, blank=True)
    indicator = models.CharField(max_length=10, blank=True)
    folio = models.CharField(max_length=40, blank=True)
    litho = models.CharField(max_length=40, blank=True)
    observaciones = models.CharField(max_length=300, blank=True)
    source_client_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'answer_key_rows'
        ordering = ['area', 'tipo', 'client_id']
        unique_together = [['created_by', 'client_id']]
        indexes = [
            models.Index(fields=['created_by', 'area', 'tipo']),
            models.Index(fields=['created_by', 'source_client_id']),
        ]

    def __str__(self):
        return f'{self.area} - {self.tipo}'


class ProgramaVacante(models.Model):
    """Número de vacantes configurado para un programa de estudios."""
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='programa_vacantes',
    )
    programa = models.CharField(max_length=200)
    vacantes = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'programa_vacantes'
        ordering = ['programa']
        unique_together = [['created_by', 'programa']]
        indexes = [
            models.Index(fields=['created_by', 'programa']),
        ]

    def __str__(self):
        return f'{self.programa}: {self.vacantes}'


class CalificationConfig(models.Model):
    """Valores de puntuación por área para el usuario actual."""
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='calification_configs',
    )
    area = models.CharField(max_length=100)
    correct_value = models.DecimalField(max_digits=8, decimal_places=3, default=10)
    incorrect_value = models.DecimalField(max_digits=8, decimal_places=3, default=0)
    blank_value = models.DecimalField(max_digits=8, decimal_places=3, default=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'calification_configs'
        ordering = ['area']
        unique_together = [['created_by', 'area']]
        indexes = [
            models.Index(fields=['created_by', 'area']),
        ]

    def __str__(self):
        return f'{self.area}: +{self.correct_value}/{self.incorrect_value}/{self.blank_value}'


class DniCorrection(models.Model):
    """Corrección confirmada del DNI de una hoja que no coincidía con el padrón.

    Es un registro de auditoría: no cambia la hoja ni el padrón. Deshacerla la marca
    como revocada (revoked_at) en lugar de borrarla.
    """
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='dni_corrections',
    )
    litho = models.CharField(max_length=40)
    original_dni = models.CharField(max_length=20, blank=True)
    corrected_dni = models.CharField(max_length=8)
    confirmed_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'dni_correcciones'
        ordering = ['-confirmed_at']
        constraints = [
            models.UniqueConstraint(
                fields=['created_by', 'litho'],
                condition=models.Q(revoked_at__isnull=True),
                name='uniq_active_dni_correction_per_sheet',
            ),
            models.UniqueConstraint(
                fields=['created_by', 'corrected_dni'],
                condition=models.Q(revoked_at__isnull=True),
                name='uniq_active_dni_correction_per_student',
            ),
        ]

    def __str__(self):
        return f'{self.litho}: {self.original_dni or "?"} -> {self.corrected_dni}'


class QuestionException(models.Model):
    """Excepción de una pregunta (anulada o con varias respuestas válidas) de una clave.

    Se liga al contenido de la clave sobre la que se decidió (`key_sha256`, calculado por el
    servidor): si la clave cambia, la excepción deja de aplicarse. Deshacerla la revoca
    (revoked_at) en lugar de borrarla, para conservar la auditoría.
    """
    ANULADA_OTORGAR = 'ANULADA_OTORGAR'
    ANULADA_EXCLUIR = 'ANULADA_EXCLUIR'
    CLAVE_MULTIPLE = 'CLAVE_MULTIPLE'
    TYPE_CHOICES = [
        (ANULADA_OTORGAR, 'Anulada: el punto es para todos'),
        (ANULADA_EXCLUIR, 'Anulada: no cuenta para nadie'),
        (CLAVE_MULTIPLE, 'Varias respuestas válidas'),
    ]

    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='question_exceptions',
    )
    area = models.CharField(max_length=100, blank=True, default='')
    tipo = models.CharField(max_length=1, blank=True, default='')
    question_number = models.PositiveSmallIntegerField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    valid_answers = models.CharField(max_length=5, blank=True, default='')
    reason = models.CharField(max_length=300)
    document_ref = models.CharField(max_length=200, blank=True, default='')
    key_sha256 = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'excepciones_pregunta'
        ordering = ['area', 'tipo', 'question_number']
        constraints = [
            models.UniqueConstraint(
                fields=['created_by', 'area', 'tipo', 'question_number'],
                condition=models.Q(revoked_at__isnull=True),
                name='uniq_active_question_exception_per_key_question',
            ),
        ]

    def __str__(self):
        return f'{self.area or "General"}/{self.tipo or "-"} P{self.question_number}: {self.type}'
