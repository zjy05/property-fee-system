@echo off
title Print Agent Self Test
cd /d "%~dp0"
echo Running self test - the dot matrix printer should output one page.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0print-agent.ps1" -SelfTest
echo.
pause
