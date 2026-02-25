@echo off
chcp 65001 >nul
echo ========================================
echo 虎鲸标记 SRS 插件部署脚本
echo ========================================
echo.

REM 设置源目录和目标目录
set SOURCE_DIR=D:\orca插件\虎鲸标记 内置闪卡\dist
set TARGET_DIR=C:\Users\1\Documents\orca\plugins\srs\dist
set ORCA_EXE=D:\orcanote\Orca Note\Orca Note.exe

echo [1/3] 检查源目录...
if not exist "%SOURCE_DIR%" (
    echo 错误：源目录不存在 - %SOURCE_DIR%
    pause
    exit /b 1
)

echo [2/3] 复制 dist 文件夹到插件目录...
echo 源目录: %SOURCE_DIR%
echo 目标目录: %TARGET_DIR%
echo.

REM 删除目标目录（如果存在）
if exist "%TARGET_DIR%" (
    echo 删除旧的 dist 文件夹...
    rmdir /s /q "%TARGET_DIR%"
)

REM 创建父目录（如果不存在）
if not exist "C:\Users\1\Documents\orca\plugins\srs" (
    echo 创建插件目录...
    mkdir "C:\Users\1\Documents\orca\plugins\srs"
)

REM 复制文件夹
echo 复制文件...
xcopy "%SOURCE_DIR%" "%TARGET_DIR%\" /E /I /Y /Q

if errorlevel 1 (
    echo 错误：复制失败
    pause
    exit /b 1
)

echo 复制完成！
echo.

echo [3/3] 启动 Orca Note...
if not exist "%ORCA_EXE%" (
    echo 警告：Orca Note 可执行文件不存在 - %ORCA_EXE%
    pause
    exit /b 1
)

start "" "%ORCA_EXE%"

echo.
echo ========================================
echo 部署完成！Orca Note 已启动
echo ========================================
timeout /t 2 >nul
