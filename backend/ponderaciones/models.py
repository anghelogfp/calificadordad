from django.db import models


class Ponderacion(models.Model):
    """Modelo legacy — mantenido para compatibilidad."""
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
        unique_together = [['area', 'subject']]
        indexes = [
            models.Index(fields=['area', 'order']),
        ]

    def __str__(self):
        return f'{self.area} - {self.subject} ({self.ponderation})'


class PlantillaPonderacion(models.Model):
    """
    Colección nombrada de pesos por asignatura, reutilizable entre procesos.

    - area=null  → global, aparece en todas las áreas (ej: Modo Simple)
    - area=X     → específica de un área
    """
    name = models.CharField(max_length=200)
    area = models.CharField(max_length=100, blank=True, null=True)
    question_total = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'plantillas_ponderacion'
        ordering = ['area', 'name']
        indexes = [
            models.Index(fields=['area']),
        ]

    def update_question_total(self):
        total = self.items.aggregate(total=models.Sum('question_count'))['total'] or 0
        self.question_total = total
        self.save(update_fields=['question_total', 'updated_at'])

    def __str__(self):
        area_label = f' [{self.area}]' if self.area else ' [General]'
        return f'{self.name}{area_label}'


class PlantillaItem(models.Model):
    """Una asignatura con su peso dentro de una PlantillaPonderacion."""
    plantilla = models.ForeignKey(
        PlantillaPonderacion,
        on_delete=models.CASCADE,
        related_name='items',
    )
    subject = models.CharField(max_length=200)
    question_count = models.IntegerField(default=1)
    ponderation = models.DecimalField(max_digits=10, decimal_places=3)
    order = models.IntegerField(default=0)

    class Meta:
        db_table = 'plantilla_items'
        ordering = ['order', 'subject']
        indexes = [
            models.Index(fields=['plantilla', 'order']),
        ]

    def __str__(self):
        return f'{self.plantilla.name} — {self.subject} ({self.question_count} pregs)'
