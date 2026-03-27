from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Ponderacion
from .serializers import PonderacionSerializer


class PonderacionViewSet(viewsets.ModelViewSet):
    queryset = Ponderacion.objects.all()
    serializer_class = PonderacionSerializer

    def get_queryset(self):
        queryset = Ponderacion.objects.all()
        area = self.request.query_params.get('area')
        convocatoria = self.request.query_params.get('convocatoria')
        if area:
            queryset = queryset.filter(area__iexact=area)
        if convocatoria:
            queryset = queryset.filter(convocatoria_id=convocatoria)
        return queryset.order_by('area', 'order', 'subject')

    @action(detail=False, methods=['get'])
    def areas(self, request):
        """Retorna la lista de áreas únicas"""
        convocatoria = request.query_params.get('convocatoria')
        qs = Ponderacion.objects.all()
        if convocatoria:
            qs = qs.filter(convocatoria_id=convocatoria)
        areas = qs.values_list('area', flat=True).distinct()
        return Response(list(areas))

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Crea o actualiza múltiples ponderaciones a la vez"""
        data = request.data
        if not isinstance(data, list):
            return Response(
                {'error': 'Se espera una lista de ponderaciones'},
                status=status.HTTP_400_BAD_REQUEST
            )

        created = []
        errors = []
        convocatoria_id = request.query_params.get('convocatoria')

        for item in data:
            if convocatoria_id:
                item = {**item, 'convocatoria': convocatoria_id}

            serializer = PonderacionSerializer(data=item)
            if serializer.is_valid():
                # Buscar existente por convocatoria + area + subject
                filter_kwargs = {
                    'area__iexact': item.get('area', ''),
                    'subject__iexact': item.get('subject', ''),
                }
                if convocatoria_id:
                    filter_kwargs['convocatoria_id'] = convocatoria_id
                else:
                    filter_kwargs['convocatoria__isnull'] = True

                existing = Ponderacion.objects.filter(**filter_kwargs).first()

                if existing:
                    serializer = PonderacionSerializer(existing, data=item)
                    if serializer.is_valid():
                        serializer.save()
                        created.append(serializer.data)
                    else:
                        errors.append({'data': item, 'errors': serializer.errors})
                else:
                    serializer.save()
                    created.append(serializer.data)
            else:
                errors.append({'data': item, 'errors': serializer.errors})

        response_data = {'created': created, 'count': len(created)}
        if errors:
            response_data['errors'] = errors

        return Response(response_data, status=status.HTTP_201_CREATED)
