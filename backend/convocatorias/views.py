from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Area, DatFormatConfig
from .serializers import AreaSerializer, DatFormatConfigSerializer

DEFAULT_AREAS = [
    {'name': 'Biomédicas', 'question_count': 60, 'vacantes': 0, 'order': 1},
    {'name': 'Sociales',   'question_count': 60, 'vacantes': 0, 'order': 2},
    {'name': 'Ingeniería', 'question_count': 60, 'vacantes': 0, 'order': 3},
]


class AreaViewSet(viewsets.ModelViewSet):
    serializer_class = AreaSerializer
    queryset = Area.objects.all()

    @action(detail=False, methods=['post'])
    def init_defaults(self, request):
        """Inicializa las áreas por defecto si no existen."""
        created = []
        for area_data in DEFAULT_AREAS:
            area, _ = Area.objects.get_or_create(
                name=area_data['name'],
                defaults={
                    'question_count': area_data['question_count'],
                    'vacantes': area_data['vacantes'],
                    'order': area_data['order'],
                },
            )
            created.append(AreaSerializer(area).data)
        return Response({'areas': created})

    @action(detail=True, methods=['patch'])
    def set_vacantes(self, request, pk=None):
        area = self.get_object()
        vacantes = request.data.get('vacantes')
        if vacantes is None:
            return Response({'error': 'vacantes es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        area.vacantes = int(vacantes)
        area.save()
        return Response(AreaSerializer(area).data)


class DatFormatConfigViewSet(viewsets.ModelViewSet):
    serializer_class = DatFormatConfigSerializer

    def get_queryset(self):
        return DatFormatConfig.objects.all()

    def list(self, request, *args, **kwargs):
        """Retorna el registro singleton (crea uno con defaults si no existe)."""
        config, _ = DatFormatConfig.objects.get_or_create(pk=1)
        return Response(DatFormatConfigSerializer(config).data)

    def update(self, request, *args, **kwargs):
        config, _ = DatFormatConfig.objects.get_or_create(pk=1)
        serializer = DatFormatConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
