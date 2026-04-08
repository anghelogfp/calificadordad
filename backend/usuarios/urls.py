from django.urls import path
from . import views

urlpatterns = [
    path('auth/login/', views.login, name='auth-login'),
    path('auth/refresh/', views.refresh_token, name='auth-refresh'),
    path('auth/me/', views.me, name='auth-me'),
    path('auth/logout/', views.logout, name='auth-logout'),
]
