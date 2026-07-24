@echo off
setlocal
cd /d "%~dp0"

rem PowerShell performs dependency detection, installation, and startup.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-system.ps1"
set "EXIT_CODE=%errorlevel%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Startup stopped with error code %EXIT_CODE%.
  pause
)

exit /b %EXIT_CODE%
