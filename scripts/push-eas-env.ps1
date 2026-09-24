# Nahraje premenne z .env do EAS Environment (preview + production).
# Pred spustenim: eas login
# Pouzitie: .\scripts\push-eas-env.ps1
# Pushne cely .env vcetne SHAREPOINT_LIST_VOZIDLA_ID a SHAREPOINT_LIST_REZERVACIE_ID.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"

if (-not (Test-Path $envFile)) {
  Write-Error "Chyba $envFile - skopirujte .env.example a vyplnte hodnoty."
}

Set-Location $root

Write-Host "preview environment"
npx eas-cli env:push preview --path $envFile --force

Write-Host "production environment"
npx eas-cli env:push production --path $envFile --force

Write-Host "Hotovo. Overte Environment variables na expo.dev v projekte golpretech-dochadzka."
