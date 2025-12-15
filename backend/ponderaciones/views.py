from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt
from .models import Ponderacion
from .serializers import PonderacionSerializer


class PonderacionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar las ponderaciones.
    
    Permite listar, crear, actualizar y eliminar ponderaciones.
    También incluye endpoints especiales para filtrar por área.
    """
    queryset = Ponderacion.objects.all()
    serializer_class = PonderacionSerializer
    
    def get_queryset(self):
        """
        Opcionalmente filtra por área si se proporciona el parámetro 'area'
        """
        queryset = Ponderacion.objects.all()
        area = self.request.query_params.get('area', None)
        if area:
            queryset = queryset.filter(area__iexact=area)
        return queryset.order_by('area', 'order', 'subject')
    
    @action(detail=False, methods=['get'])
    def areas(self, request):
        """
        Endpoint para obtener la lista de áreas únicas
        """
        areas = Ponderacion.objects.values_list('area', flat=True).distinct()
        return Response(list(areas))
    
    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """
        Endpoint para crear múltiples ponderaciones a la vez
        """
        data = request.data
        if not isinstance(data, list):
            return Response(
                {'error': 'Se espera una lista de ponderaciones'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        created = []
        errors = []
        
        for item in data:
            serializer = PonderacionSerializer(data=item)
            if serializer.is_valid():
                # Verificar si ya existe
                existing = Ponderacion.objects.filter(
                    area__iexact=item.get('area'),
                    subject__iexact=item.get('subject')
                ).first()
                
                if existing:
                    # Actualizar si existe
                    serializer = PonderacionSerializer(existing, data=item)
                    if serializer.is_valid():
                        serializer.save()
                        created.append(serializer.data)
                else:
                    # Crear nuevo
                    serializer.save()
                    created.append(serializer.data)
            else:
                errors.append({
                    'data': item,
                    'errors': serializer.errors
                })
        
        response_data = {
            'created': created,
            'count': len(created)
        }
        
        if errors:
            response_data['errors'] = errors
        
        return Response(response_data, status=status.HTTP_201_CREATED)

