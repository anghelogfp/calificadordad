from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import ProcesoCalificacionViewSet, VerificadorSesionViewSet

router = DefaultRouter()
router.register(r'procesos', ProcesoCalificacionViewSet, basename='proceso')
router.register(r'verificador', VerificadorSesionViewSet, basename='verificador')

urlpatterns = [
    path('', include(router.urls)),
]
