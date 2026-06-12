from django.db import models


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

    class Meta:
        db_table = 'dat_format_configs'

    def __str__(self):
        return 'Formato DAT global'
