@echo off
title Xuyen A Server - port 8792
cd /d "%~dp0"

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8792 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel%==0 (
  echo Server dang chay san tren cong 8792.
  echo Mo trinh duyet: http://localhost:8792
  start "" http://localhost:8792
  timeout /t 3 >nul
  exit /b 0
)

echo Dang khoi dong server tren cong 8792...
node server.mjs
echo.
echo Server da dung. Nhan phim bat ky de dong cua so.
pause >nul
