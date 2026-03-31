from rest_framework import serializers
from .models import Ponderacion, PlantillaPonderacion, PlantillaItem


class PonderacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ponderacion
        fields = [
            'id', 'convocatoria', 'area', 'subject',
            'question_count', 'ponderation', 'order',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PlantillaItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlantillaItem
        fields = ['id', 'subject', 'question_count', 'ponderation', 'order']
        read_only_fields = ['id']


class PlantillaPonderacionSerializer(serializers.ModelSerializer):
    items = PlantillaItemSerializer(many=True, read_only=True)

    class Meta:
        model = PlantillaPonderacion
        fields = [
            'id', 'convocatoria', 'name', 'area',
            'question_total', 'items', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'question_total', 'created_at', 'updated_at']


class PlantillaPonderacionWriteSerializer(serializers.ModelSerializer):
    """Para crear/actualizar plantillas con items incluidos."""
    items = PlantillaItemSerializer(many=True, required=False)

    class Meta:
        model = PlantillaPonderacion
        fields = ['id', 'convocatoria', 'name', 'area', 'items']
        read_only_fields = ['id']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        plantilla = PlantillaPonderacion.objects.create(**validated_data)
        for item_data in items_data:
            PlantillaItem.objects.create(plantilla=plantilla, **item_data)
        plantilla.update_question_total()
        return plantilla

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                PlantillaItem.objects.create(plantilla=instance, **item_data)
            instance.update_question_total()
        return instance
