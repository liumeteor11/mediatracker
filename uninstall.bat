@echo off
setlocal
chcp 65001 >nul

echo ==========================================
echo      MediaTracker AI - Uninstall
echo ==========================================
echo.
echo This script will remove the Desktop Shortcut and project dependencies.
echo.
echo [WARNING] This will delete:
echo  - Desktop Shortcut
echo  - node_modules folder
echo  - dist folder
echo.
set /p CONFIRM=Are you sure you want to proceed? (Y/N): 
if /i "%CONFIRM%" neq "Y" goto :EOF

echo.
echo [1/3] Removing Desktop Shortcut...
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\MediaTracker AI.lnk"
if exist "%SHORTCUT_PATH%" (
    del "%SHORTCUT_PATH%"
    echo    - Shortcut removed.
) else (
    echo    - Shortcut not found.
)

echo [2/3] Cleaning project files (node_modules, dist)...
if exist "node_modules" (
    rmdir /s /q "node_modules"
    echo    - node_modules removed.
)
if exist "dist" (
    rmdir /s /q "dist"
    echo    - dist removed.
)

echo [3/3] Cleanup Complete.
echo.
echo To fully remove the application, please delete this folder manually:
echo %~dp0
echo.
pause
