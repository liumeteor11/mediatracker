@echo off
setlocal
chcp 65001 >nul

cd /d "%~dp0"
echo Starting MediaTracker AI...
echo Opening browser...
start "" "http://localhost:2333"
echo Starting server...
call npm run dev
