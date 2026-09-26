@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js / npm was not found. Install Node.js 20+ from https://nodejs.org
  pause
  exit /b 1
)
call npm.cmd run setup
pause
