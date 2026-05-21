@echo off
setlocal
pushd "%~dp0"

echo Starting SoL browser development mode...

if not exist node_modules (
  echo Installing dependencies...
  if exist package-lock.json (
    npm ci
  ) else (
    npm install
  )
  if errorlevel 1 goto error
)

echo Starting webpack watch build...
npm run dev
if errorlevel 1 goto error

echo Done.
pause
exit /b 0

:error
echo.
echo Something failed. See the error above.
pause
exit /b 1
