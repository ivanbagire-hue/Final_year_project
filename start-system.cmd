@echo off
setlocal
cd /d "%~dp0"

if exist "%ProgramFiles%\nodejs\node.exe" (
  "%ProgramFiles%\nodejs\node.exe" server.js
  exit /b %errorlevel%
)

where node.exe >nul 2>nul
if %errorlevel% equ 0 (
  node.exe server.js
  exit /b %errorlevel%
)

echo Node.js was not found.
echo Install Node.js 22.5 or newer, then run this launcher again.
pause
exit /b 1
