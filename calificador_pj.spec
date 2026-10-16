# -*- mode: python ; coding: utf-8 -*-
"""
Especificación PyInstaller para generar `CalificadorPJ.exe` en Windows.
Empaqueta Django + DRF + Waitress + Frontend compilado (`frontend/dist`) + Actas (`reportes-actas`).
"""

from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

ROOT_DIR = Path(SPECPATH).resolve()
BACKEND_DIR = ROOT_DIR / 'backend'
FRONTEND_DIST_DIR = ROOT_DIR / 'frontend' / 'dist'
REPORTES_ACTAS_DIR = ROOT_DIR / 'reportes-actas'

datas = []
if FRONTEND_DIST_DIR.exists():
    datas.append((str(FRONTEND_DIST_DIR), 'frontend/dist'))
if REPORTES_ACTAS_DIR.exists():
    datas.append((str(REPORTES_ACTAS_DIR), 'reportes-actas'))

for pkg in ('rest_framework', 'rest_framework_simplejwt', 'django'):
    try:
        datas += collect_data_files(pkg)
    except Exception:
        pass

hiddenimports = (
    collect_submodules('django')
    + collect_submodules('rest_framework')
    + collect_submodules('rest_framework_simplejwt')
    + collect_submodules('waitress')
    + [
        'config',
        'config.settings',
        'config.urls',
        'config.api_urls',
        'config.wsgi',
        'config.backup_views',
        'config.cors_middleware',
        'config.permissions',
        'convocatorias',
        'convocatorias.apps',
        'convocatorias.models',
        'convocatorias.serializers',
        'convocatorias.views',
        'convocatorias.urls',
        'ponderaciones',
        'ponderaciones.apps',
        'ponderaciones.models',
        'ponderaciones.serializers',
        'ponderaciones.views',
        'ponderaciones.urls',
        'resultados',
        'resultados.apps',
        'resultados.models',
        'resultados.serializers',
        'resultados.views',
        'resultados.urls',
        'usuarios',
        'usuarios.apps',
        'usuarios.serializers',
        'usuarios.views',
        'usuarios.urls',
    ]
)

a = Analysis(
    [str(BACKEND_DIR / 'run_standalone.py')],
    pathex=[str(BACKEND_DIR), str(ROOT_DIR)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'scipy', 'numpy', 'pandas'],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='CalificadorPJ',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
