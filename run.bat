@echo off
setlocal

cd /d "%~dp0"

echo.
echo [TOBACO] Installing dependencies...
call npm install
if errorlevel 1 goto :error

echo.
echo [TOBACO] Starting development server in new window...
start "TOBACO Dev Server" cmd /k "cd /d ""%~dp0"" && npm run dev"

echo [TOBACO] Waiting for server startup...
timeout /t 5 /nobreak >nul

echo.
echo [TOBACO] Select panel to open:
echo   1. Distributor / Admin Login
echo   2. Shopkeeper Login
echo   3. Home
set /p PANEL_CHOICE=Enter choice (1/2/3): 

if "%PANEL_CHOICE%"=="1" start "" "http://localhost:8080/admin-login"
if "%PANEL_CHOICE%"=="2" start "" "http://localhost:8080/shopkeeper-login"
if "%PANEL_CHOICE%"=="3" start "" "http://localhost:8080/"

if not "%PANEL_CHOICE%"=="1" if not "%PANEL_CHOICE%"=="2" if not "%PANEL_CHOICE%"=="3" (
  echo [TOBACO] Invalid choice. Opening Distributor/Admin login by default.
  start "" "http://localhost:8080/admin-login"
)

goto :eof

:error
echo.
echo [TOBACO] Command failed with error code %errorlevel%.
pause
exit /b %errorlevel%
