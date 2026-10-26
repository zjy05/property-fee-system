@echo off
title 物业收费系统 - 打印助手
cd /d "%~dp0"

where powershell >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [错误] 没有找到 Windows PowerShell。
  echo  请用 Windows 10/11 运行本程序。
  echo.
  pause
  exit /b 1
)

echo ============================================================
echo    物业收费系统 - 本地打印助手
echo ------------------------------------------------------------
echo    这个窗口要一直开着，关掉窗口 = 停止打印服务。
echo    启动后到网页「打印中心」点「针式直打」即可。
echo ============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0print-agent.ps1"

echo.
echo  打印助手已退出。
pause
