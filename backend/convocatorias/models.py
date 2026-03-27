from django.db import models


class Convocatoria(models.Model):
    STATUS_ACTIVE = 'active'
    STATUS_CLOSED = 'closed'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Activa'),
        (STATUS_CLOSED, 'Cerrada'),
    ]

    name = models.CharField(max_length=200)
    year = models.IntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'convocatorias'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.year}) - {self.get_status_display()}"


class Area(models.Model):
    convocatoria = models.ForeignKey(
        Convocatoria,
        on_delete=models.CASCADE,
        related_name='areas'
    )
    name = models.CharField(max_length=100)
    question_count = models.IntegerField(default=60)
    vacantes = models.IntegerField(default=0)
    order = models.IntegerField(default=0)

    class Meta:
        db_table = 'areas'
        unique_together = [['convocatoria', 'name']]
        ordering = ['convocatoria', 'order', 'name']

    def __str__(self):
        return f"{self.convocatoria.name} - {self.name}"


class CalificationConfig(models.Model):
    convocatoria = models.ForeignKey(
        Convocatoria,
        on_delete=models.CASCADE,
        related_name='calification_configs'
    )
    area_name = models.CharField(max_length=100)
    correct_value = models.DecimalField(max_digits=8, decimal_places=3, default=10)
    incorrect_value = models.DecimalField(max_digits=8, decimal_places=3, default=0)
    blank_value = models.DecimalField(max_digits=8, decimal_places=3, default=2)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'calification_configs'
        unique_together = [['convocatoria', 'area_name']]

    def __str__(self):
        return f"{self.convocatoria.name} - {self.area_name}"


class DatFormatConfig(models.Model):
    convocatoria = models.OneToOneField(
        Convocatoria,
        on_delete=models.CASCADE,
        related_name='dat_format'
    )
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

    class Meta:
        db_table = 'dat_format_configs'

    def __str__(self):
        return f"Formato DAT - {self.convocatoria.name}"
