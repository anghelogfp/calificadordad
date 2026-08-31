@echo off
REM Inicia los servidores de desarrollo de backend (Django) y frontend (Vite) en ventanas separadas.

set ROOT=%~dp0

start "Backend (Django)" cmd /k "cd /d "%ROOT%backend" && call "%ROOT%venv\Scripts\activate.bat" && python manage.py runserver"

start "Frontend (Vite)" cmd /k "cd /d "%ROOT%frontend" && npm run dev"
