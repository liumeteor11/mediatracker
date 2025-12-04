@echo off
setlocal
chcp 65001 >nul

echo ==========================================
echo      MediaTracker AI - Installation
echo ==========================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [Error] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    echo and try again.
    pause
    exit /b 1
)

echo [1/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [Error] Failed to install dependencies.
    pause
    exit /b 1
)

echo [2/3] Creating Desktop Shortcut...
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\MediaTracker AI.lnk"
set "TARGET_PATH=%~dp0run.bat"
set "ICON_PATH=%~dp0public\icon.png"
set "WORK_DIR=%~dp0"

set "SCRIPT=%TEMP%\CreateShortcut.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%SCRIPT%"
echo sLinkFile = "%SHORTCUT_PATH%" >> "%SCRIPT%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%SCRIPT%"
echo oLink.TargetPath = "%TARGET_PATH%" >> "%SCRIPT%"
echo oLink.WorkingDirectory = "%WORK_DIR%" >> "%SCRIPT%"
echo oLink.Description = "MediaTracker AI" >> "%SCRIPT%"
echo oLink.IconLocation = "%ICON_PATH%" >> "%SCRIPT%"
echo oLink.Save >> "%SCRIPT%"

cscript /nologo "%SCRIPT%"
if exist "%SCRIPT%" del "%SCRIPT%"

echo [3/3] Setup Complete!
echo.
echo You can now launch MediaTracker AI from your Desktop.
echo.
echo Press any key to launch it now...
pause >nul
call run.bat
