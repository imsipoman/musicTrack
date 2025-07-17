@echo off
chcp 65001 >nul
echo 正在启动拼好组音游谱面生成器，请稍等...
echo.

:: 使用PowerShell启动应用
echo 正在使用PowerShell启动应用...
start "" powershell.exe -NoExit -NoProfile -ExecutionPolicy Bypass -Command "& {[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; Set-Location '%~dp0'; Write-Host '拼好组提示：正在启动服务器，请稍等...' -ForegroundColor Cyan; Start-Process 'http://localhost:3000'; Write-Host '服务器启动中，请勿关闭此窗口...' -ForegroundColor Yellow; npm start; Write-Host '服务器已停止运行，按任意键退出...' -ForegroundColor Red; Read-Host}"

:: 提示信息
echo.
echo 如果浏览器没有自动打开，请手动访问: http://localhost:3000
echo 请不要关闭PowerShell窗口，关闭窗口会停止服务器
echo. 