@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0INICIAR_AR10_ORION_CASA.ps1" -NoTunnel
pause
