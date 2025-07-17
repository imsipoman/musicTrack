# 音游谱面生成器自动启动脚本 (PowerShell版)
# 开启详细错误显示
$ErrorActionPreference = "Stop"

# 创建日志文件
$logFile = Join-Path $PSScriptRoot "startup_log.txt"
function Write-Log {
    param (
        [string]$Message,
        [string]$Color = "White"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Add-Content -Path $logFile -Value $logMessage
    Write-Host $Message -ForegroundColor $Color
}

# 清空之前的日志
if (Test-Path $logFile) {
    Clear-Content $logFile
}

try {
    Write-Log "===================================" "Cyan"
    Write-Log "拼好组音游谱面生成器自动启动脚本" "Cyan"
    Write-Log "===================================" "Cyan"
    Write-Log "启动日志已创建: $logFile"
    Write-Log ""

    # 检查管理员权限
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if ($isAdmin) {
        Write-Log "已获取管理员权限，继续执行..." "Green"
    } else {
        Write-Log "需要管理员权限来安装依赖！" "Red"
        Write-Log "请右键点击此文件，选择'以管理员身份运行'" "Yellow"
        Read-Host "按任意键退出"
        exit 1
    }

    # 检查Node.js是否已安装
    try {
        Write-Log "检查Node.js是否已安装..."
        $nodeVersion = node -v
        $nodeVersionNumber = $nodeVersion.Substring(1).Split('.')[0]
        Write-Log "检测到Node.js已安装，版本: $nodeVersionNumber" "Green"
    }
    catch {
        Write-Log "Node.js未安装，准备下载安装..." "Yellow"
        Write-Log "错误详情: $_"
        
        # 使用PowerShell下载Node.js安装包
        Write-Log "下载Node.js安装程序..." "Yellow"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        try {
            Invoke-WebRequest -Uri 'https://nodejs.org/dist/v16.20.0/node-v16.20.0-x64.msi' -OutFile 'node_setup.msi'
        }
        catch {
            Write-Log "下载Node.js失败！错误详情: $_" "Red"
            Read-Host "按任意键退出"
            exit 1
        }
        
        if (-not (Test-Path -Path 'node_setup.msi')) {
            Write-Log "下载Node.js失败！安装包不存在" "Red"
            Read-Host "按任意键退出"
            exit 1
        }
        
        Write-Log "安装Node.js，请稍候..." "Yellow"
        try {
            Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", "node_setup.msi", "/quiet", "/norestart" -Wait
        }
        catch {
            Write-Log "安装Node.js失败！错误详情: $_" "Red"
            Read-Host "按任意键退出"
            exit 1
        }
        
        # 检查安装是否成功
        try {
            $nodeVersion = node -v
            Write-Log "Node.js安装成功！版本: $nodeVersion" "Green"
            Remove-Item -Path 'node_setup.msi'
        }
        catch {
            Write-Log "Node.js安装可能不完整，无法执行node命令。错误详情: $_" "Red"
            Write-Log "请尝试手动安装Node.js后再运行此脚本" "Red"
            Read-Host "按任意键退出"
            exit 1
        }
    }

    # 检查npm是否可用
    try {
        Write-Log "检查npm是否可用..."
        $npmVersion = npm -v
        Write-Log "npm可用，版本: $npmVersion" "Green"
    }
    catch {
        Write-Log "npm不可用，Node.js安装可能不完整。错误详情: $_" "Red"
        Write-Log "请手动重新安装Node.js" "Red"
        Read-Host "按任意键退出"
        exit 1
    }

    # 安装项目依赖
    Write-Log "正在安装项目依赖，请稍候..." "Yellow"
    try {
        $npmOutput = npm install 2>&1
        Write-Log "npm安装输出: $npmOutput"
        
        if ($LASTEXITCODE -ne 0) {
            Write-Log "安装依赖失败！退出代码: $LASTEXITCODE" "Red"
            Read-Host "按任意键退出"
            exit 1
        }
    }
    catch {
        Write-Log "安装依赖过程中出错: $_" "Red"
        Read-Host "按任意键退出"
        exit 1
    }

    Write-Log "依赖安装成功！" "Green"

    # 启动项目
    Write-Log "正在启动浏览器..." "Cyan"
    try {
        Start-Process "http://localhost:3000"
        Write-Log "浏览器启动成功" "Green"
    }
    catch {
        Write-Log "浏览器启动失败: $_。请手动访问 http://localhost:3000" "Yellow"
    }

    # 启动Node服务器
    Write-Log "服务器启动中，请不要关闭此窗口..." "Yellow"
    try {
        node server.js
    }
    catch {
        Write-Log "启动服务器失败！错误详情: $_" "Red"
        Read-Host "按任意键退出"
        exit 1
    }
}
catch {
    Write-Log "执行脚本时发生未捕获的错误: $_" "Red"
    Write-Log "错误位置: $($_.InvocationInfo.PositionMessage)" "Red"
    Write-Log "错误类型: $($_.Exception.GetType().FullName)" "Red"
    Read-Host "按任意键退出"
    exit 1
}

Write-Log "如果浏览器没有自动打开，请手动访问: http://localhost:3000" "Yellow"
Read-Host "按任意键退出" 