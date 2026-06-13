param(
  [int]$Port = 8970,
  [switch]$NoTunnel,
  [switch]$NoBrowser,
  [switch]$KeepExisting
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Runtime = Join-Path $Root "runtime"
$Logs = Join-Path $Root "logs"
$Tools = Join-Path $Root "tools"
$Cloudflared = Join-Path $Tools "cloudflared.exe"
$ServerLog = Join-Path $Logs "AR10_ORION_SERVER.log"
$ServerErrLog = Join-Path $Logs "AR10_ORION_SERVER.err.log"
$TunnelLog = Join-Path $Logs "AR10_ORION_CLOUDFLARED.log"
$ServerPidFile = Join-Path $Runtime "AR10_ORION_SERVER.pid"
$TunnelPidFile = Join-Path $Runtime "AR10_ORION_TUNNEL.pid"
$UrlFile = Join-Path $Runtime "TUNNEL_URL.txt"
$LocalUrlFile = Join-Path $Runtime "AR10_ORION_LOCAL.url"
$IpadUrlFile = Join-Path $Runtime "AR10_ORION_IPAD.url"

New-Item -ItemType Directory -Force -Path $Runtime, $Logs, $Tools | Out-Null

function Write-ShortcutUrl {
  param([string]$Path, [string]$Url)
  @("[InternetShortcut]", "URL=$Url") | Set-Content -LiteralPath $Path -Encoding ASCII
}

function Get-PortProcessIds {
  param([int]$TargetPort)
  @(Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique)
}

function Stop-PortListeners {
  param([int]$TargetPort)
  foreach ($procId in Get-PortProcessIds -TargetPort $TargetPort) {
    try {
      Stop-Process -Id $procId -Force -ErrorAction Stop
      Start-Sleep -Milliseconds 300
    } catch {
      Write-Warning "Nao consegui parar processo na porta $TargetPort PID=${procId}: $($_.Exception.Message)"
    }
  }
}

function Stop-OldTunnel {
  param([int]$TargetPort)
  $items = @(Get-CimInstance Win32_Process -Filter "Name = 'cloudflared.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match "127\.0\.0\.1:$TargetPort" })
  foreach ($item in $items) {
    try {
      Stop-Process -Id $item.ProcessId -Force -ErrorAction Stop
      Start-Sleep -Milliseconds 300
    } catch {
      Write-Warning "Nao consegui parar cloudflared PID=$($item.ProcessId): $($_.Exception.Message)"
    }
  }
}

function Wait-Status {
  param([int]$TargetPort)
  $deadline = (Get-Date).AddSeconds(30)
  while ((Get-Date) -lt $deadline) {
    try {
      return Invoke-RestMethod -Uri "http://127.0.0.1:$TargetPort/api/status" -TimeoutSec 2
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  throw "Servidor AR10 Orion nao respondeu em http://127.0.0.1:$TargetPort/api/status"
}

if (-not $KeepExisting) {
  Stop-PortListeners -TargetPort $Port
  Stop-OldTunnel -TargetPort $Port
}

$env:ORION_HOST = "127.0.0.1"
$env:ORION_PORT = "$Port"
$server = Start-Process -FilePath "python" `
  -ArgumentList @("-m", "src.ui_cockpit.dashboard_render") `
  -WorkingDirectory $Root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $ServerLog `
  -RedirectStandardError $ServerErrLog `
  -PassThru

Set-Content -LiteralPath $ServerPidFile -Value $server.Id -Encoding ASCII
$status = Wait-Status -TargetPort $Port

$LocalUrl = "http://127.0.0.1:$Port"
Write-ShortcutUrl -Path $LocalUrlFile -Url $LocalUrl

if (-not $NoBrowser) {
  Start-Process $LocalUrl
}

$TunnelUrl = $null
if (-not $NoTunnel) {
  if (-not (Test-Path -LiteralPath $Cloudflared)) {
    throw "cloudflared.exe nao encontrado em $Cloudflared"
  }

  Remove-Item -LiteralPath $TunnelLog, $UrlFile -Force -ErrorAction SilentlyContinue

  $tunnel = Start-Process -FilePath $Cloudflared `
    -ArgumentList @("tunnel", "--url", $LocalUrl, "--no-autoupdate", "--loglevel", "info", "--logfile", $TunnelLog) `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -PassThru

  Set-Content -LiteralPath $TunnelPidFile -Value $tunnel.Id -Encoding ASCII

  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline -and -not $TunnelUrl) {
    Start-Sleep -Seconds 1
    if (Test-Path -LiteralPath $TunnelLog) {
      $content = Get-Content -LiteralPath $TunnelLog -Raw -ErrorAction SilentlyContinue
      $match = [regex]::Match($content, "https://[a-zA-Z0-9-]+\.trycloudflare\.com")
      if ($match.Success) {
        $TunnelUrl = $match.Value
      }
    }
  }

  if (-not $TunnelUrl) {
    throw "Tunnel nao retornou URL em 60s. Veja $TunnelLog"
  }

  Set-Content -LiteralPath $UrlFile -Value $TunnelUrl -Encoding ASCII
  Write-ShortcutUrl -Path $IpadUrlFile -Url $TunnelUrl

  $desktop = [Environment]::GetFolderPath("Desktop")
  if ($desktop) {
    Write-ShortcutUrl -Path (Join-Path $desktop "AR10 ORION - LINK IPAD.url") -Url $TunnelUrl
  }
}

Write-Host ""
Write-Host "AR10 ORION rodando pela pasta GitHub" -ForegroundColor Cyan
Write-Host "Local:  $LocalUrl" -ForegroundColor Green
if ($TunnelUrl) {
  Write-Host "iPad:   $TunnelUrl" -ForegroundColor Green
  Write-Host "URL salva em: $UrlFile"
}
Write-Host "Modo:   $($status.mode) / real_orders_enabled=$($status.real_orders_enabled)"
Write-Host ""
