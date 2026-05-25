@echo off
REM Start Django server for testing
cd backend
echo.
echo Starting Django Development Server...
echo.
python manage.py runserver
pause
