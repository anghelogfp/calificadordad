@echo off
setlocal enabledelayedexpansion
title Compilador CalificadorPJ.exe - Poder Judicial (CSJ Puno / UNA Puno)

echo ====================================================================
echo   COMPILACION DE EJECUTABLE PORTABLE: CalificadorPJ.exe
echo ====================================================================

cd /d "%~dp0"

echo [1/4] Compilando frontend Vue 3 (Vite)...
pushd frontend
call npm ci
if errorlevel 1 (
    echo ERROR: Fallo npm ci en frontend.
    popd
    exit /b 1
)
call npm run build
if errorlevel 1 (
    echo ERROR: Fallo npm run build en frontend.
    popd
    exit /b 1
)
popd

echo [2/4] Instalando dependencias de Python y PyInstaller...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt pyinstaller waitress
if errorlevel 1 (
    echo ERROR: Fallo la instalacion de dependencias Python.
    exit /b 1
)

echo [3/4] Empaquetando CalificadorPJ.exe con PyInstaller...
pyinstaller --clean --noconfirm calificador_pj.spec
if errorlevel 1 (
    echo ERROR: Fallo el empaquetado con PyInstaller.
    exit /b 1
)

echo [4/4] Verificando ejecutable (smoke test)...
dist\CalificadorPJ.exe --smoke-test
if errorlevel 1 (
    echo ERROR: Fallo la verificacion del ejecutable.
    exit /b 1
)

echo ====================================================================
echo   COMPILACION EXITOSA: dist\CalificadorPJ.exe
echo ====================================================================
endlocal
