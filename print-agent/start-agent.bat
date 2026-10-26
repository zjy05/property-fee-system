@echo off
title Property Fee Print Agent
cd /d "%~dp0"
echo ============================================================
echo    Property Fee System - Local Print Agent
echo ------------------------------------------------------------
echo    Keep this window open. Closing it stops the print service.
echo ============================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0print-agent.ps1"
echo.
pause
