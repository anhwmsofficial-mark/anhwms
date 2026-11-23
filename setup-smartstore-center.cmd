@echo off
chcp 65001 > nul
cd /d "%~dp0"
if not exist "%~dp0release\SmartstoreCenterSetup.exe" (
  echo SmartstoreCenterSetup.exe 파일이 없습니다.
  echo 시스템 담당자에게 최신 설치 파일을 요청하세요.
  pause
  exit /b 1
)
start "" "%~dp0release\SmartstoreCenterSetup.exe"
