from rest_framework.routers import DefaultRouter
from .views import (
    ConvocatoriaViewSet,
    AreaViewSet,
    CalificationConfigViewSet,
    DatFormatConfigViewSet,
)

router = DefaultRouter()
router.register(r'convocatorias', ConvocatoriaViewSet, basename='convocatoria')
router.register(r'areas', AreaViewSet, basename='area')
router.register(r'calification-configs', CalificationConfigViewSet, basename='calification-config')
router.register(r'dat-format-configs', DatFormatConfigViewSet, basename='dat-format-config')

urlpatterns = router.urls
