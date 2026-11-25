$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Installer Node.js 22 ou supérieur, puis relancer START.ps1.' }
$runtime = Join-Path $PSScriptRoot '.runtime'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$pidFile = Join-Path $runtime 'server.json'
$nodeMajor = [int]((& node -p 'process.versions.node.split(".")[0]') | Select-Object -First 1)
if ($nodeMajor -lt 22) { throw 'Node.js 22 ou supérieur est requis.' }
if (Test-Path -LiteralPath $pidFile) {
    $saved = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
    $existing = Get-Process -Id $saved.pid -ErrorAction SilentlyContinue
    if ($existing -and $existing.ProcessName -eq 'node' -and $existing.StartTime.ToUniversalTime().Ticks.ToString() -eq $saved.started) { Write-Host 'Cymora est déjà lancée : http://127.0.0.1:4173'; return }
}
$stopToken = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
$previousPort = $env:PORT
$previousToken = $env:PELAGIC_STOP_TOKEN
try {
    $env:PORT = '4173'
    $env:PELAGIC_STOP_TOKEN = $stopToken
    $proc = Start-Process -FilePath (Get-Command node).Source -ArgumentList 'server.mjs' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'server.log') -RedirectStandardError (Join-Path $runtime 'error.log')
} finally {
    $env:PORT = $previousPort
    $env:PELAGIC_STOP_TOKEN = $previousToken
}
@{pid=$proc.Id; started=$proc.StartTime.ToUniversalTime().Ticks.ToString(); token=$stopToken} | ConvertTo-Json | Set-Content -LiteralPath $pidFile
$ready = $false
for ($attempt = 0; $attempt -lt 40; $attempt++) {
    $proc.Refresh()
    if ($proc.HasExited) { throw (Get-Content -LiteralPath (Join-Path $runtime 'error.log') -Raw) }
    try {
        $response = Invoke-WebRequest -Uri 'http://127.0.0.1:4173/health' -UseBasicParsing -TimeoutSec 1
        if ($response.StatusCode -eq 200 -and $response.Content.Contains('ok')) { $ready = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 250
}
if (-not $ready) { throw 'Le serveur local ne répond pas. Consulter .runtime/error.log, puis STOP.ps1.' }
Write-Host 'Cymora est prête : http://127.0.0.1:4173/'
Write-Host 'Pour arrêter : .\STOP.ps1'
