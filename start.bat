@echo off
chcp 65001 >nul
title Study System - 一键启动

echo ========================================
echo   Study System - 一键启动
echo ========================================
echo.

:: 切换到项目目录
cd /d "%~dp0"

:: 检查 node_modules 是否存在
if not exist "node_modules" (
    echo [1/3] 安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo 安装依赖失败，请检查网络连接后重试。
        pause
        exit /b 1
    )
) else (
    echo [1/3] 依赖已安装，跳过。
)

:: 检查 .env 文件
if not exist ".env" (
    echo [警告] 未找到 .env 文件，正在从 .env.example 复制...
    copy ".env.example" ".env" >nul
    echo 请编辑 .env 文件，填入正确的 DATABASE_URL 后重新运行本脚本。
    pause
    exit /b 1
)

:: 生成 Prisma Client
echo [2/3] 生成 Prisma Client...
call npx prisma generate >nul 2>&1
if %errorlevel% neq 0 (
    echo Prisma Client 生成失败，尝试修复文件锁定问题...
    :: 尝试重命名可能被锁定的引擎文件（Windows Defender 常见问题）
    if exist "node_modules\.prisma\client\query_engine-windows.dll.node" (
        ren "node_modules\.prisma\client\query_engine-windows.dll.node" "query_engine-windows.dll.node.bak" >nul 2>&1
    )
    call npx prisma generate >nul 2>&1
    if %errorlevel% neq 0 (
        echo Prisma Client 生成失败，请检查 Prisma 配置。
        pause
        exit /b 1
    ) else (
        echo Prisma Client 生成成功。
    )
)

:: 启动开发服务器
echo [3/3] 启动开发服务器...
echo.
echo API 服务: http://localhost:3000
echo Web 服务: http://localhost:5173
echo.
echo 按 Ctrl+C 停止所有服务
echo ========================================
echo.

call npm run dev

pause
