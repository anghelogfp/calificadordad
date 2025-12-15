from rest_framework import serializers
from .models import Ponderacion


class PonderacionSerializer(serializers.ModelSerializer):
    """Serializer para el modelo Ponderacion"""
    
    class Meta:
        model = Ponderacion
        fields = ['id', 'area', 'subject', 'question_count', 'ponderation', 'order', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

