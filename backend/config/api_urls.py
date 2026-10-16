from django.urls import path, include
from .backup_views import export_backup, restore_backup

urlpatterns = [
    path('backup/export/', export_backup, name='backup-export'),
    path('backup/restore/', restore_backup, name='backup-restore'),
    path('', include('usuarios.urls')),
    path('', include('ponderaciones.urls')),
    path('', include('convocatorias.urls')),
    path('', include('resultados.urls')),
]

