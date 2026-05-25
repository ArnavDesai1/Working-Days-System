@echo off
REM Test locking API
cd backend
echo.
echo Testing Session-Based Locking API...
echo.
python test_locking.py
echo.
pause
