"""
Middleware simple para manejar CORS en desarrollo
"""
from django.utils.deprecation import MiddlewareMixin


class CorsMiddleware(MiddlewareMixin):
    """
    Middleware simple para permitir CORS en desarrollo
    """
    
    def process_response(self, request, response):
        # Permitir todos los orígenes en desarrollo
        origin = request.META.get('HTTP_ORIGIN')
        if origin:
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-CSRFToken'
            response['Access-Control-Allow-Credentials'] = 'true'
        
        # Manejar preflight requests
        if request.method == 'OPTIONS':
            response.status_code = 200
        
        return response

