# Junction + prebuild + run:android (Windows)
# Spustenie: .\scripts\run-android-dev.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$link = "C:\dev\golpretech-dochadzka"
$log = Join-Path $root "android-build.log"

function Write-Log($msg) {
  $line = "[$(Get-Date -Format 'HH:mm:ss')] $msg"
  Write-Host $line
  Add-Content -Path $log -Value $line
}

Set-Content -Path $log -Value "=== Android build $(Get-Date) ==="
Write-Log "Projekt: $root"

# Junction na ASCII cestu (minule fungovalo)
New-Item -ItemType Directory -Path "C:\dev" -Force | Out-Null
if (Test-Path $link) {
  $item = Get-Item $link -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    Write-Log "Mazem stary junction: $link"
    cmd /c "rmdir `"$link`""
  } else {
    Write-Error "C:\dev\golpretech-dochadzka existuje a nie je junction. Zmazte ju rucne."
  }
}
cmd /c "mklink /J `"$link`" `"$root`""
Write-Log "Junction: $link -> $root"

Set-Location $link
Write-Log "Prebuild..."
npx expo prebuild --platform android --clean 2>&1 | Tee-Object -FilePath (Join-Path $root "prebuild.log")
if ($LASTEXITCODE -ne 0) {
  Write-Log "PREBUILD ZLYHAL (exit $LASTEXITCODE). Pozrite prebuild.log"
  exit $LASTEXITCODE
}

$mainApp = Join-Path $link "android\app\src\main\java\com\golpretech\dochadzka\MainApplication.kt"
if (-not (Test-Path $mainApp)) {
  Write-Log "CHYBA: MainApplication.kt neexistuje"
  exit 1
}
Write-Log "MainApplication.kt OK"

Write-Log "Spustam expo run:android..."
npx expo run:android
exit $LASTEXITCODE
