# Spusti Android prebuild a zapise vysledok do prebuild.log
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$log = Join-Path $root "prebuild.log"

Write-Host "Projekt: $root"
Remove-Item -Recurse -Force (Join-Path $root "android") -ErrorAction SilentlyContinue

npx expo prebuild --platform android --clean *> $log
$code = $LASTEXITCODE

$mainApp = Join-Path $root "android\app\src\main\java\com\golpretech\dochadzka\MainApplication.kt"
Write-Host ""
Write-Host "Exit code: $code"
Write-Host "MainApplication.kt: $(Test-Path $mainApp)"
Write-Host "--- poslednych 15 riadkov logu ---"
Get-Content $log -Tail 15 -ErrorAction SilentlyContinue

exit $code
