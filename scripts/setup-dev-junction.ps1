# Expo prebuild na Windows zlyhava, ak cesta projektu obsahuje diakritiku alebo medzery
# (napr. "Nová APP"). Tento skript vytvori junction na ASCII cestu.
#
# Ak ste premenovali zlozku projektu, najprv zmazte stary junction:
#   cmd /c "rmdir C:\dev\golpretech-dochadzka"
#
# Pouzitie:
#   .\scripts\setup-dev-junction.ps1
#   cd C:\dev\golpretech-dochadzka
#   npx expo run:android

$ErrorActionPreference = "Stop"
$source = Split-Path -Parent $PSScriptRoot
$link = "C:\dev\golpretech-dochadzka"

if (-not (Test-Path $source)) {
  Write-Error "Zdrojovy projekt neexistuje: $source"
}

New-Item -ItemType Directory -Path "C:\dev" -Force | Out-Null

if (Test-Path $link) {
  $item = Get-Item $link -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    Write-Host "Junction uz existuje: $link -> $($item.Target)"
  } else {
    Write-Error "C:\dev\golpretech-dochadzka existuje, ale nie je junction. Premenujte alebo zmazte ju rucne."
  }
} else {
  cmd /c "mklink /J `"$link`" `"$source`""
  Write-Host "Vytvorene: $link -> $source"
}

Write-Host ""
Write-Host "Dalsi krok:"
Write-Host "  cd $link"
Write-Host "  npx expo run:android"
