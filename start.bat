@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

for /f "delims=" %%i in ('python -c "import secrets; print(secrets.token_hex(16))"') do set GUARDIAN_TOKEN=%%i

echo ========================================================
echo       Starting Smart OS Guardian Security Dashboard      
echo ========================================================
echo Token: %GUARDIAN_TOKEN%
echo Starting Backend on http://127.0.0.1:8000 ...
echo Starting Frontend on http://localhost:5173 ...
echo.

start "Guardian Backend (FastAPI)" cmd /k "cd /d %~dp0backend && set GUARDIAN_TOKEN=%GUARDIAN_TOKEN% && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

timeout /t 2 >nul

start "Guardian Frontend (Vite React)" cmd /k "cd /d %~dp0frontend && set GUARDIAN_TOKEN=%GUARDIAN_TOKEN% && npm run dev"

timeout /t 3 >nul

echo Opening dashboard in default browser...
start http://localhost:5173
