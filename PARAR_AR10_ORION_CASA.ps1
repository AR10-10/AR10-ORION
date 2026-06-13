param(
  [int]$Port = 8970
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Runtime = Join-Path $Root "runtime"

function Stop-PidFile {
  param([string]$Path)
  if (Test-Path -LiteralPath $Path) {
    $pidText = (Get-Content -LiteralPath $Path -Raw -ErrorAction SilentlyContinue).Trim()
    if ($pidText -match "^\d+$") {
      Stop-Process -Id ([int]$pidText) -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
  }
}

Stop-PidFile -Path (Join-Path $Runtime "AR10_ORION_SERVER.pid")
Stop-PidFile -Path (Join-Path $Runtime "AR10_ORION_TUNNEL.pid")

Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

Get-CimInstance Win32_Process -Filter "Name = 'cloudflared.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match "127\.0\.0\.1:$Port" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Write-Host "AR10 Orion parado na porta $Port." -ForegroundColor Cyan
