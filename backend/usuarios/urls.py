from django.urls import path
from . import views

urlpatterns = [
    path('auth/login/', views.login, name='auth-login'),
    path('auth/refresh/', views.refresh_token, name='auth-refresh'),
    path('auth/me/', views.me, name='auth-me'),
    path('auth/logout/', views.logout, name='auth-logout'),
    path('usuarios/', views.usuarios_list, name='usuarios-list'),
    path('usuarios/<int:pk>/', views.usuario_detail, name='usuario-detail'),
    path('usuarios/<int:pk>/set-password/', views.usuario_set_password, name='usuario-set-password'),
]
