from rest_framework.routers import DefaultRouter
from .views import AreaViewSet, DatFormatConfigViewSet

router = DefaultRouter()
router.register(r'areas', AreaViewSet, basename='area')
router.register(r'dat-format-configs', DatFormatConfigViewSet, basename='dat-format-config')

urlpatterns = router.urls
