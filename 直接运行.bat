@echo off
echo 正在启动音游谱面生成器，请稍等...
echo.

:: 检查Node.js是否已安装
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo 错误: 未安装Node.js，请先安装Node.js
    echo 您可以从 https://nodejs.org/ 下载并安装
    pause
    exit /b 1
)

:: 检查npm是否已安装
where npm >nul 2>&1
if %errorLevel% neq 0 (
    echo 错误: npm不可用，请重新安装Node.js
    pause
    exit /b 1
)

:: 安装依赖
echo 正在安装依赖...
call npm install

if %errorLevel% neq 0 (
    echo 错误: 安装依赖失败，错误代码 %errorLevel%
    echo 请检查网络连接或手动执行 npm install
    pause
    exit /b %errorLevel%
)

:: 打开浏览器
start http://localhost:3000

:: 启动服务器
echo 服务器正在启动，请不要关闭此窗口
echo 访问地址: http://localhost:3000
node server.js

echo 服务器已关闭
pause 