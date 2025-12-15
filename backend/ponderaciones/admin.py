from django.contrib import admin
from .models import Ponderacion


@admin.register(Ponderacion)
class PonderacionAdmin(admin.ModelAdmin):
    list_display = ['area', 'subject', 'question_count', 'ponderation', 'order']
    list_filter = ['area']
    search_fields = ['subject', 'area']
    ordering = ['area', 'order', 'subject']

