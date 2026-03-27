from django.db import models


class Ponderacion(models.Model):
    """Modelo para almacenar las ponderaciones de los cursos"""

    convocatoria = models.ForeignKey(
        'convocatorias.Convocatoria',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ponderaciones',
    )
    area = models.CharField(max_length=100)
    subject = models.CharField(max_length=200)
    question_count = models.IntegerField(default=1)
    ponderation = models.DecimalField(max_digits=10, decimal_places=3)
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ponderaciones'
        ordering = ['area', 'order', 'subject']
        # unique_together ahora incluye convocatoria (nullable no rompe filas existentes)
        unique_together = [['convocatoria', 'area', 'subject']]
        indexes = [
            models.Index(fields=['area', 'order']),
            models.Index(fields=['convocatoria', 'area']),
        ]

    def __str__(self):
        conv = f" [{self.convocatoria}]" if self.convocatoria_id else ""
        return f"{self.area} - {self.subject} ({self.ponderation}){conv}"
