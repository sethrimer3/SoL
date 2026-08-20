@echo off
setlocal
pushd "%~dp0"

echo Starting SoL desktop...

if not exist node_modules (
  echo Installing dependencies...
  if exist package-lock.json (
    call npm ci
  ) else (
    call npm install
  )
  if errorlevel 1 goto error
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron binary is missing. Downloading it...
  node "node_modules\electron\install.js"
  if errorlevel 1 goto error
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron binary still missing after download.
  goto error
)

echo Building SoL...
call npm run build
if errorlevel 1 goto error

echo Launching Electron...
start "SoL" /D "%~dp0" "%~dp0node_modules\electron\dist\electron.exe" .

echo Done.
exit /b 0

:error
echo.
echo Something failed. See the error above.
pause
exit /b 1
