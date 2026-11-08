@echo off
title Zubair Hall Mess Manager
setlocal
cd /d "%~dp0"

echo ============================================
echo   Zubair Hall Mess Manager - starting...
echo ============================================
echo.

REM ---- Check Node.js 20+ (uses the included one, or downloads it automatically) ----
node -e "process.exit(Number(process.versions.node.split('.')[0])>=20?0:1)" 2>nul
if %errorlevel%==0 goto node_ready

if exist "runtime\node.exe" (
  echo Using the included Node.js runtime...
  goto node_portable
)

echo Node.js was not found on this PC.
echo One-time automatic download of the runtime, about 30 MB - please wait...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue';[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$idx=Invoke-RestMethod 'https://nodejs.org/dist/index.json';$v=($idx|Where-Object {$_.version -like 'v22.*'}|Select-Object -First 1).version;Write-Host ('Downloading Node.js '+$v);Invoke-WebRequest ('https://nodejs.org/dist/'+$v+'/node-'+$v+'-win-x64.zip') -OutFile 'node-runtime.zip'"
if errorlevel 1 goto node_fail

echo Extracting...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue';Expand-Archive 'node-runtime.zip' -DestinationPath 'node-tmp'"
if errorlevel 1 goto node_fail

set "NODEDIR="
for /d %%D in ("node-tmp\node-v*") do set "NODEDIR=%%D"
if "%NODEDIR%"=="" goto node_fail
robocopy "%NODEDIR%" "runtime" /E >nul
del /q "node-runtime.zip" >nul 2>nul
rmdir /s /q "node-tmp" >nul 2>nul
echo Node.js runtime saved in the "runtime" folder. It will not be downloaded again.
goto node_portable

:node_fail
echo.
echo Could not prepare Node.js automatically. Check your internet connection and run
echo this file again, or install the LTS version from https://nodejs.org manually.
echo.
pause
exit /b 1

:node_portable
set "PATH=%~dp0runtime;%PATH%"

:node_ready
if not exist "node_modules" (
  echo First run: installing dependencies, please wait 5-10 minutes...
  call npm install --no-audit --no-fund
  if errorlevel 1 ( echo Installation failed. Check your internet connection. & pause & exit /b 1 )
)

if not exist "db\custom.db" (
  if not exist "db" mkdir "db"
  echo Creating the database...
  call npx prisma db push
  if errorlevel 1 ( echo Database creation failed. & pause & exit /b 1 )
)

if not exist ".next\BUILD_ID" (
  echo Building the app, please wait a few minutes...
  call npm run build
  if errorlevel 1 ( echo Build failed. & pause & exit /b 1 )
)

echo.
echo All set! The app opens in your browser automatically in a few seconds.
echo Keep this window OPEN while using the app. To stop, just close this window.
echo.
echo     On this PC:              http://localhost:3000
echo     On phones (same WiFi):   http://YOUR-IPV4-ADDRESS-BELOW:3000
echo.
ipconfig | findstr /i "IPv4"
echo.

start "" /min cmd /c "timeout /t 15 /nobreak >nul & start "" http://localhost:3000"
call npm start
pause
