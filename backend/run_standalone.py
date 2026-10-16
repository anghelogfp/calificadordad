#!/usr/bin/env python3
"""
Launcher autónomo de escritorio para Calificador DAD — Poder Judicial (CSJ Puno / UNA Puno).

Empaquetable con PyInstaller (`CalificadorPJ.exe`).
Al ejecutarse:
1. Configura la base de datos SQLite en `<carpeta_exe>/data/db.sqlite3` (o `CALIFICADOR_DB_PATH`).
2. Ejecuta migraciones de Django automáticamente.
3. Inicializa el superusuario por defecto (`admin` / `admin123`), `DatFormatConfig` (30 preguntas)
   y la plantilla global `"Poder Judicial — 30 Preguntas"`.
4. Inicia el servidor WSGI (Waitress o servidor multithread de Django) en `127.0.0.1:8000`
   y abre automáticamente el navegador predeterminado.
"""

import argparse
import os
import socket
import sys
import threading
import time
import webbrowser
from decimal import Decimal
from pathlib import Path


def get_runtime_dir() -> Path:
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def configure_environment() -> Path:
    runtime_dir = get_runtime_dir()
    backend_dir = Path(__file__).resolve().parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    if not os.environ.get('CALIFICADOR_DB_PATH'):
        data_dir = runtime_dir / 'data'
        data_dir.mkdir(parents=True, exist_ok=True)
        (data_dir / 'backups').mkdir(parents=True, exist_ok=True)
        os.environ['CALIFICADOR_DB_PATH'] = str(data_dir / 'db.sqlite3')

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    os.environ.setdefault('DJANGO_DEBUG', 'true')
    return Path(os.environ['CALIFICADOR_DB_PATH']).resolve()


def bootstrap_database():
    import django
    django.setup()

    from django.contrib.auth.models import User
    from django.core.management import call_command
    from convocatorias.models import Area, DatFormatConfig
    from ponderaciones.models import PlantillaItem, PlantillaPonderacion

    call_command('migrate', interactive=False, verbosity=1)

    if not User.objects.filter(is_superuser=True).exists():
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@unap.edu.pe',
                'is_staff': True,
                'is_superuser': True,
                'first_name': 'Administrador',
                'last_name': 'Comisión PJ',
            },
        )
        if created or not admin_user.is_superuser:
            admin_user.is_staff = True
            admin_user.is_superuser = True
            admin_user.set_password(os.environ.get('CALIFICADOR_ADMIN_PASSWORD', 'admin123'))
            admin_user.save()

    dat_config, created = DatFormatConfig.objects.get_or_create(
        pk=1,
        defaults={
            'header_length': 21,
            'answers_length': 30,
            'litho_offset': 0,
            'litho_length': 6,
            'tipo_offset': 6,
            'tipo_length': 1,
            'dni_offset': 7,
            'dni_length': 8,
            'aula_offset': 15,
            'aula_length': 3,
            'answers_offset': 18,
            'response_answers_offset': 7,
        },
    )

    plantilla, _ = PlantillaPonderacion.objects.get_or_create(
        name='Poder Judicial — 30 Preguntas',
        area=None,
        defaults={'question_total': 30},
    )
    if not plantilla.items.exists():
        PlantillaItem.objects.create(
            plantilla=plantilla,
            subject='Evaluación de Conocimientos PJ',
            question_count=30,
            ponderation=Decimal('1.000'),
            order=1,
        )
        plantilla.update_question_total()

    default_areas = [
        {'name': 'Biomédicas', 'question_count': 60, 'vacantes': 0, 'order': 1},
        {'name': 'Sociales', 'question_count': 60, 'vacantes': 0, 'order': 2},
        {'name': 'Ingeniería', 'question_count': 60, 'vacantes': 0, 'order': 3},
    ]
    for area_data in default_areas:
        Area.objects.get_or_create(name=area_data['name'], defaults=area_data)


def find_available_port(host: str, preferred_port: int) -> int:
    for port in range(preferred_port, preferred_port + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            if sock.connect_ex((host, port)) != 0:
                return port
    return preferred_port


def serve_application(host: str, port: int, open_browser: bool = True):
    from config.wsgi import application

    url = f'http://{host}:{port}'
    print('=' * 68)
    print('  SISTEMA CALIFICADOR DAD — PODER JUDICIAL (CSJ PUNO / UNA PUNO)')
    print('=' * 68)
    print(f'  URL de la Aplicación : {url}')
    print(f'  Base de Datos SQLite : {os.environ.get("CALIFICADOR_DB_PATH")}')
    print('  Usuario por defecto  : admin / admin123')
    print('  Presione Ctrl+C en esta ventana para detener el servidor.')
    print('=' * 68)

    if open_browser:
        threading.Timer(1.2, lambda: webbrowser.open(url)).start()

    try:
        from waitress import serve
        serve(application, host=host, port=port, threads=8)
    except ImportError:
        from wsgiref.simple_server import WSGIRequestHandler, WSGIServer, make_server
        from socketserver import ThreadingMixIn

        class ThreadingWSGIServer(ThreadingMixIn, WSGIServer):
            daemon_threads = True

        with make_server(host, port, application, server_class=ThreadingWSGIServer, handler_class=WSGIRequestHandler) as httpd:
            httpd.serve_forever()


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description='Launcher autónomo Calificador PJ')
    parser.add_argument('--host', default=os.environ.get('CALIFICADOR_HOST', '127.0.0.1'))
    parser.add_argument('--port', type=int, default=int(os.environ.get('CALIFICADOR_PORT', '8000')))
    parser.add_argument('--no-browser', action='store_true', help='No abrir el navegador automáticamente')
    parser.add_argument('--smoke-test', action='store_true', help='Inicializa BD y verifica configuración sin bloquear')
    args = parser.parse_args(argv)

    db_path = configure_environment()
    bootstrap_database()

    if args.smoke_test:
        print(f'SMOKE_TEST_OK db={db_path}')
        return 0

    port = find_available_port(args.host, args.port)
    serve_application(args.host, port, open_browser=not args.no_browser)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
