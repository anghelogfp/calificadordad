from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PonderacionViewSet

router = DefaultRouter()
router.register(r'ponderaciones', PonderacionViewSet, basename='ponderacion')

urlpatterns = [
    path('', include(router.urls)),
]

