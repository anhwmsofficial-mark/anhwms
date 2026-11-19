$ErrorActionPreference = 'Stop'

$configPath = Join-Path $env:LOCALAPPDATA 'ANH_WMS\smartstore-center.json'
$logPath = Join-Path $env:LOCALAPPDATA 'ANH_WMS\smartstore-center.log'
$projectRoot = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path $configPath)) {
  throw "스마트스토어 센터 설정이 없습니다. setup-smartstore-center.cmd를 먼저 실행하세요."
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$secureSecret = ConvertTo-SecureString $config.encryptedClientSecret
$credential = [System.Net.NetworkCredential]::new('', $secureSecret)

$env:NAVER_COMMERCE_CLIENT_ID = [string]$config.clientId
$env:NAVER_COMMERCE_CLIENT_SECRET = $credential.Password

Set-Location $projectRoot
"[$(Get-Date -Format o)] 센터 연결 프로그램 시작" | Out-File $logPath -Append -Encoding utf8
& npm.cmd run smartstore:center *>> $logPath
