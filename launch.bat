@echo off
setlocal
cd /d "%~dp0"

where wsl >nul 2>nul
if %errorlevel% equ 0 (
    wsl -l -q >nul 2>nul
    if %errorlevel% equ 0 (
        echo Launching with WSL2...
        start "" wsl bash -lc "cd \"$(wslpath '%~dp0')\" && ./start.sh"
        timeout /t 6 >nul
        start http://localhost:5173
        exit /b 0
    )
)

echo WSL distribution not active. Launching with Windows native mode...
call "%~dp0start.bat"
