from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import PlantillaPonderacionViewSet, PonderacionViewSet

router = DefaultRouter()
router.register(r'ponderaciones', PonderacionViewSet, basename='ponderacion')
router.register(r'plantillas', PlantillaPonderacionViewSet, basename='plantilla')

urlpatterns = [
    path('', include(router.urls)),
]
