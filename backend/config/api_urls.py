from django.urls import path, include

urlpatterns = [
    path('', include('ponderaciones.urls')),
]

