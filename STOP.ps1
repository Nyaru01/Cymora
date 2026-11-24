$ErrorActionPreference = 'Stop'
$pidFile = Join-Path $PSScriptRoot '.runtime/server.json'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Host 'Aucune instance lancée par START.ps1.'; return }
$saved = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
$proc = Get-Process -Id $saved.pid -ErrorAction SilentlyContinue
if ($proc -and $proc.ProcessName -eq 'node' -and $proc.StartTime.ToUniversalTime().Ticks.ToString() -eq $saved.started) {
    if ($saved.token) {
        try {
            Invoke-WebRequest -Uri 'http://127.0.0.1:4173/__stop' -Method Post -Headers @{'X-Pelagic-Stop'=$saved.token} -TimeoutSec 3 -UseBasicParsing | Out-Null
            if (-not $proc.WaitForExit(4000)) { throw "Le serveur ne s'est pas arrêté dans le délai prévu." }
        } catch { throw 'Arrêt non confirmé. Vérifier .runtime/error.log et le processus enregistré ; aucun autre processus arrêté.' }
    } else { Stop-Process -Id $proc.Id }
    Write-Host 'PELAGIC arrêté.'
}
else { Write-Host 'Instance déjà arrêtée ; aucun autre processus touché.' }
# Retire uniquement le marqueur temporaire créé par START dans ce projet.
[System.IO.File]::Delete($pidFile)
