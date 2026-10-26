@echo off
chcp 65001 >nul
setlocal
rem ============================================================
rem  物业收费系统 - 针式打印机 静默打印启动器
rem  作用：用静默打印模式打开系统，点「打印」直接出纸，不弹打印对话框。
rem  用法：双击本文件即可；也可以把系统网址拖到本文件上。
rem ============================================================

set "URL=%~1"
if "%URL%"=="" set "URL=http://127.0.0.1:4000"

set "BROWSER="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "BROWSER=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if not defined BROWSER (
  echo.
  echo  [错误] 没有找到 Edge 或 Chrome 浏览器。
  echo  请先安装 Microsoft Edge 或 Google Chrome，再运行本文件。
  echo.
  pause
  exit /b 1
)

echo.
echo  正在以「静默打印」模式打开：%URL%
echo  提示：打印时不会再弹对话框，直接送纸。
echo  首次使用请先在系统里把针式打印机设为默认打印机，
echo  并在打印机属性里把纸张设为 180 x 210 mm（三联）。
echo.

start "" "%BROWSER%" --kiosk-printing --user-data-dir="%LOCALAPPDATA%\PropertyFeePrint" "%URL%"

endlocal
