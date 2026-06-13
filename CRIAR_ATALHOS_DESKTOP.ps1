$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Desktop = [Environment]::GetFolderPath("Desktop")
if (-not $Desktop) {
  throw "Desktop nao encontrado."
}

$shell = New-Object -ComObject WScript.Shell

function New-Shortcut {
  param(
    [string]$Name,
    [string]$Target,
    [string]$Arguments,
    [string]$WorkingDirectory,
    [string]$Description
  )
  $path = Join-Path $Desktop $Name
  $shortcut = $shell.CreateShortcut($path)
  $shortcut.TargetPath = $Target
  $shortcut.Arguments = $Arguments
  $shortcut.WorkingDirectory = $WorkingDirectory
  $shortcut.Description = $Description
  $shortcut.Save()
  return $path
}

$ps = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$startArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$Root\INICIAR_AR10_ORION_CASA.ps1`""
$stopArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$Root\PARAR_AR10_ORION_CASA.ps1`""

$created = @()
$created += New-Shortcut -Name "AR10 ORION - INICIAR CASA.lnk" -Target $ps -Arguments $startArgs -WorkingDirectory $Root -Description "Inicia AR10 Orion local e tunnel READ_ONLY pela pasta GitHub"
$created += New-Shortcut -Name "AR10 ORION - PARAR.lnk" -Target $ps -Arguments $stopArgs -WorkingDirectory $Root -Description "Para AR10 Orion local e tunnel"

@("[InternetShortcut]", "URL=http://127.0.0.1:8970") |
  Set-Content -LiteralPath (Join-Path $Desktop "AR10 ORION - PAINEL LOCAL.url") -Encoding ASCII

$created += Join-Path $Desktop "AR10 ORION - PAINEL LOCAL.url"

Write-Host "Atalhos criados:" -ForegroundColor Cyan
$created | ForEach-Object { Write-Host " - $_" }
