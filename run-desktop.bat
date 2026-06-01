@echo off
setlocal
pushd "%~dp0"

echo Starting SoL desktop...

if not exist node_modules (
  echo Installing dependencies...
  if exist package-lock.json (
    npm ci
  ) else (
    npm install
  )
  if errorlevel 1 goto error
)

echo Building SoL...
npm run build
if errorlevel 1 goto error

echo Launching Electron...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'npm.cmd' -ArgumentList @('run','electron') -WorkingDirectory '%CD%' -WindowStyle Hidden"
if errorlevel 1 goto error

timeout /t 1 /nobreak >nul

echo Done.
exit /b 0

:error
echo.
echo Something failed. See the error above.
pause
exit /b 1
