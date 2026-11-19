@echo off
chcp 65001 > nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-smartstore-center.ps1"
if errorlevel 1 (
  echo.
  echo 설치 중 오류가 발생했습니다.
  pause
)
