param(
  [int]$Port = 8970
)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $Root "INICIAR_AR10_ORION_CASA.ps1") -Port $Port
