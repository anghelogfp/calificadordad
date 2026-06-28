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
    dni = models.CharField(max_length=20, blank=True)
    paterno = models.CharField(max_length=100, blank=True)
    materno = models.CharField(max_length=100, blank=True)
    nombres = models.CharField(max_length=200, blank=True)
    observaciones = models.CharField(max_length=300, blank=True)
    area = models.CharField(max_length=100, blank=True)
    programa = models.CharField(max_length=200, blank=True)
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
