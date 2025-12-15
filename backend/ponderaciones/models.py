from django.db import models


class Ponderacion(models.Model):
    """Modelo para almacenar las ponderaciones de los cursos"""
    
    area = models.CharField(max_length=100)
    subject = models.CharField(max_length=200)  # Asignatura
    question_count = models.IntegerField(default=1)  # Cantidad de preguntas
    ponderation = models.DecimalField(max_digits=10, decimal_places=3)  # Ponderación
    order = models.IntegerField(default=0)  # Orden de visualización
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'ponderaciones'
        ordering = ['area', 'order', 'subject']
        unique_together = [['area', 'subject']]
        indexes = [
            models.Index(fields=['area', 'order']),
        ]
    
    def __str__(self):
        return f"{self.area} - {self.subject} ({self.ponderation})"

