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
npm run electron
if errorlevel 1 goto error

echo Done.
pause
exit /b 0

:error
echo.
echo Something failed. See the error above.
pause
exit /b 1
