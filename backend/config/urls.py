"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from pathlib import Path

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import include, path, re_path
from django.views.static import serve


def serve_spa_or_dist_asset(request, resource_path=''):
    dist_dir = Path(settings.FRONTEND_DIST_DIR).resolve()
    clean_rel = (resource_path or '').lstrip('/')

    if clean_rel:
        candidate = (dist_dir / clean_rel).resolve()
        try:
            candidate.relative_to(dist_dir)
        except ValueError:
            raise Http404('Ruta inválida.')
        if candidate.is_file():
            return serve(request, clean_rel, document_root=str(dist_dir))

    index_file = dist_dir / 'index.html'
    if index_file.is_file():
        return FileResponse(open(index_file, 'rb'), content_type='text/html; charset=utf-8')

    raise Http404('Frontend compilado no encontrado.')


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('config.api_urls')),
    re_path(
        r'^actas-static/(?P<path>.*)$',
        serve,
        {'document_root': str(settings.REPORTES_ACTAS_DIR)},
        name='actas-static',
    ),
    re_path(
        r'^assets/(?P<path>.*)$',
        serve,
        {'document_root': str(Path(settings.FRONTEND_DIST_DIR) / 'assets')},
        name='spa-assets',
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

urlpatterns += [
    re_path(
        r'^(?!api/|admin/|actas-static/|assets/|static/|media/)(?P<resource_path>.*)$',
        serve_spa_or_dist_asset,
        name='spa-fallback',
    ),
]

