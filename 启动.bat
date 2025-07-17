@echo off
echo 正在启动音游谱面生成器，请稍等...
powershell -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if %errorlevel% neq 0 (
  echo 程序执行出错，错误代码: %errorlevel%
  pause
  exit /b %errorlevel%
)
pause 