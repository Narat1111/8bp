@echo off
title Digital Store - Backend Server
echo ==========================================
echo    DIGITAL STORE - Starting Backend API
echo ==========================================
echo.
echo [1/2] Checking XAMPP MySQL...
echo Make sure XAMPP MySQL is running!
echo.
echo [2/2] Starting FastAPI server...
cd /d "%~dp0backend"
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
pause
