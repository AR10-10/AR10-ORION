@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CRIAR_ATALHOS_DESKTOP.ps1"
pause
