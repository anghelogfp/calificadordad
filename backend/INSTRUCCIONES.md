# Instrucciones para configurar el backend

## Pasos para activar el sistema de ponderaciones en la base de datos

1. **Activar el entorno virtual:**
   
   **En Windows PowerShell:**
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```
   
   **En Windows CMD:**
   ```cmd
   venv\Scripts\activate.bat
   ```
   
   **En Windows Git Bash:**
   ```bash
   source venv/Scripts/activate
   ```
   
   **En Linux/Mac:**
   ```bash
   source venv/bin/activate
   ```
   
   **Nota:** Si PowerShell muestra un error de política de ejecución, ejecuta primero:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

2. **Navegar al directorio backend:**
   ```bash
   cd backend
   ```

3. **Crear las migraciones:**
   ```bash
   python manage.py makemigrations ponderaciones
   ```

4. **Aplicar las migraciones:**
   ```bash
   python manage.py migrate
   ```

5. **Opcional: Crear un superusuario para acceder al admin:**
   ```bash
   python manage.py createsuperuser
   ```

6. **Iniciar el servidor:**
   ```bash
   python manage.py runserver
   ```

El servidor estará disponible en `http://localhost:8000`

## Endpoints de la API

- `GET /api/ponderaciones/` - Listar todas las ponderaciones
- `GET /api/ponderaciones/?area=Biomédicas` - Filtrar por área
- `POST /api/ponderaciones/` - Crear una ponderación
- `PUT /api/ponderaciones/{id}/` - Actualizar una ponderación
- `DELETE /api/ponderaciones/{id}/` - Eliminar una ponderación
- `POST /api/ponderaciones/bulk_create/` - Crear múltiples ponderaciones
- `GET /api/ponderaciones/areas/` - Obtener lista de áreas

## Notas

- El frontend está configurado para conectarse a `http://localhost:8000/api`
- Si el backend no está disponible, el frontend usará localStorage como fallback
- Las ponderaciones se guardan automáticamente en la base de datos cuando se crean, actualizan o eliminan

