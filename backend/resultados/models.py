from django.contrib.auth.models import User
from django.db import models


class ProcesoCalificacion(models.Model):
    """
    Un proceso agrupa los resultados de una o más áreas calificadas en un mismo
    examen. El campo local_id permite idempotencia: el frontend genera un ID
    en el cliente y el backend lo usa para actualizar en lugar de duplicar.
    """
    local_id = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=200)
    convocatoria = models.ForeignKey(
        'convocatorias.Convocatoria',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='procesos',
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='procesos',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'procesos_calificacion'
        ordering = ['-updated_at']

    def __str__(self):
        return f'{self.name} (por {self.created_by.username})'

    @property
    def area_names(self):
        return list(self.areas.values_list('area', flat=True))

    @property
    def total_candidates(self):
        return sum(a.total_candidates for a in self.areas.all())


class AreaCalificacion(models.Model):
    """Resultados de una área dentro de un proceso."""
    proceso = models.ForeignKey(
        ProcesoCalificacion,
        on_delete=models.CASCADE,
        related_name='areas',
    )
    area = models.CharField(max_length=100)
    timestamp = models.DateTimeField()

    # Config usada para esta calificación
    correct_value = models.DecimalField(max_digits=8, decimal_places=3)
    incorrect_value = models.DecimalField(max_digits=8, decimal_places=3)
    blank_value = models.DecimalField(max_digits=8, decimal_places=3)

    # Plantilla usada (snapshot para trazabilidad)
    plantilla_id = models.IntegerField(null=True, blank=True)
    plantilla_name = models.CharField(max_length=200, blank=True)
    plantilla_snapshot = models.JSONField(default=list)

    # Métricas del resumen
    total_candidates = models.IntegerField(default=0)
    missing_responses = models.IntegerField(default=0)
    missing_keys = models.IntegerField(default=0)
    total_weight = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    answers_length = models.IntegerField(default=60)

    class Meta:
        db_table = 'areas_calificacion'
        unique_together = [['proceso', 'area']]
        ordering = ['area']

    def __str__(self):
        return f'{self.proceso.name} — {self.area}'


class ResultadoCandidato(models.Model):
    """Puntaje individual de un candidato en un área."""
    area_result = models.ForeignKey(
        AreaCalificacion,
        on_delete=models.CASCADE,
        related_name='resultados',
    )
    dni = models.CharField(max_length=20)
    paterno = models.CharField(max_length=100, blank=True)
    materno = models.CharField(max_length=100, blank=True)
    nombres = models.CharField(max_length=200, blank=True)
    area = models.CharField(max_length=100)
    programa = models.CharField(max_length=200, blank=True)
    score = models.DecimalField(max_digits=10, decimal_places=2)
    position = models.IntegerField(default=0)
    position_in_programa = models.IntegerField(default=0)
    is_ingresante = models.BooleanField(default=False)

    class Meta:
        db_table = 'resultados_candidatos'
        unique_together = [['area_result', 'dni']]
        ordering = ['position']

    def __str__(self):
        return f'{self.dni} — {self.area} — {self.score}'
