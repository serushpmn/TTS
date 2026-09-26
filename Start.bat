@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js / npm was not found. Install Node.js 20+ from https://nodejs.org
  pause
  exit /b 1
)

if not exist "backend\.venv\Scripts\python.exe" (
  echo First run: installing dependencies...
  call npm.cmd run setup
  if errorlevel 1 (
    echo Setup failed.
    pause
    exit /b 1
  )
)

if not exist "frontend\node_modules\" (
  echo Installing frontend packages...
  call npm.cmd run setup
  if errorlevel 1 (
    echo Setup failed.
    pause
    exit /b 1
  )
)

echo Starting Dialogue Studio...
call npm.cmd run start
pause
