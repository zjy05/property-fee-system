@echo off
title 打印助手 - 自检
cd /d "%~dp0"

echo 正在通过打印助手打一张自检页...
echo 如果针式打印机吐出一张写着「打印助手自检」的纸，说明助手和打印机都通了。
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0print-agent.ps1" -SelfTest

echo.
pause
