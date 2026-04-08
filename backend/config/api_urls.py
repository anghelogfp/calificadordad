from django.urls import path, include

urlpatterns = [
    path('', include('usuarios.urls')),
    path('', include('ponderaciones.urls')),
    path('', include('convocatorias.urls')),
    path('', include('resultados.urls')),
]
