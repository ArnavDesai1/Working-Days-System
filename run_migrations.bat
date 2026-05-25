@echo off
REM Run migration for locking fields
cd backend
echo.
echo Running migrations for locking system...
echo.
python manage.py migrate timesheets clients
echo.
pause
