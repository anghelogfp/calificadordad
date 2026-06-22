"""Minimal CORS middleware restricted to explicitly configured origins."""
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin


class CorsMiddleware(MiddlewareMixin):
    """
    Middleware simple para permitir CORS en desarrollo
    """
    
    def process_response(self, request, response):
        origin = request.META.get('HTTP_ORIGIN')
        if origin in settings.CORS_ALLOWED_ORIGINS:
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-CSRFToken'
            response['Access-Control-Allow-Credentials'] = 'true'
            response['Vary'] = 'Origin'
        
        # Manejar preflight requests
        if request.method == 'OPTIONS' and origin in settings.CORS_ALLOWED_ORIGINS:
            response.status_code = 200
        
        return response

