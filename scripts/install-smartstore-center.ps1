$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$configDir = Join-Path $env:LOCALAPPDATA 'ANH_WMS'
$configPath = Join-Path $configDir 'smartstore-center.json'
$startScript = Join-Path $PSScriptRoot 'start-smartstore-center.ps1'
$startupDir = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDir 'ANH 스마트스토어 센터 연결.lnk'

Write-Host ''
Write-Host 'ANH 스마트스토어 센터 연결 설치' -ForegroundColor Cyan
Write-Host '네이버에서 새로 발급한 값을 입력하세요. 시크릿은 화면에 표시되지 않습니다.'

$clientId = (Read-Host '애플리케이션 ID').Trim()
if (-not $clientId) {
  throw '애플리케이션 ID가 필요합니다.'
}

$clientSecret = Read-Host '애플리케이션 시크릿' -AsSecureString
$encryptedClientSecret = ConvertFrom-SecureString $clientSecret

New-Item -ItemType Directory -Path $configDir -Force | Out-Null
@{
  clientId = $clientId
  encryptedClientSecret = $encryptedClientSecret
  installedAt = (Get-Date).ToString('o')
} | ConvertTo-Json | Set-Content $configPath -Encoding utf8

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = 'powershell.exe'
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`""
$shortcut.WorkingDirectory = $projectRoot
$shortcut.Description = 'ANH 스마트스토어 센터 연결 자동 시작'
$shortcut.Save()

$existing = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host '기존 연결 프로그램을 종료한 뒤 Windows에 다시 로그인하면 자동으로 시작됩니다.' -ForegroundColor Yellow
} else {
  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', "`"$startScript`""
  )
  Write-Host '센터 연결 프로그램을 시작했습니다.' -ForegroundColor Green
}

Write-Host '설치 완료: 이후 작업자는 WMS 화면만 사용하면 됩니다.' -ForegroundColor Green
Write-Host '문제가 있으면 다음 로그를 확인하세요:'
Write-Host (Join-Path $configDir 'smartstore-center.log')
Write-Host ''
Read-Host 'Enter를 누르면 닫힙니다'
