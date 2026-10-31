# Build the app and run it as a local background server (default port 3100).
# Usage:  powershell -File scripts\deploy-local.ps1 [-Port 3100] [-MaxGames 200] [-Stop]
# -MaxGames (or an existing MAX_GAMES env var) caps live + dormant games on the server
# (server default 50). Empty dormant games expire after an hour on their own.
# The deployed copy lives in ..\aliens-deploy so rebuilding or editing the repo
# never breaks the running game. Runtime content packs and saved sessions created
# through the deployed app stay in the deploy folder (content\ and data\).
param(
  [int]$Port = 3100,
  [int]$MaxGames = 0,
  [switch]$Stop
)
$ErrorActionPreference = "Stop"
$env:Path += ";C:\Program Files\nodejs"
$repo    = Split-Path -Parent $PSScriptRoot
$src     = Join-Path $repo "web app"
$deploy  = Join-Path (Split-Path -Parent $repo) "aliens-deploy"
$app     = Join-Path $deploy "web app"
$pidFile = Join-Path $deploy "server.pid"

function Stop-Server {
  if (Test-Path $pidFile) {
    $oldPid = Get-Content $pidFile
    if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
      Stop-Process -Id $oldPid -Force
      Write-Host "stopped server pid $oldPid"
    }
    Remove-Item $pidFile -Force
  }
}

if ($Stop) { Stop-Server; exit 0 }

Write-Host "== building =="
Push-Location $src
npm run build | Select-Object -Last 2
Pop-Location

Write-Host "== syncing to $app =="
New-Item -ItemType Directory -Force -Path $app | Out-Null
robocopy (Join-Path $src "dist")   (Join-Path $app "dist")   /MIR /NFL /NDL /NJH /NJS | Out-Null
robocopy (Join-Path $src "server") (Join-Path $app "server") /MIR /NFL /NDL /NJH /NJS | Out-Null
Copy-Item (Join-Path $src "package.json")      $app -Force
Copy-Item (Join-Path $src "package-lock.json") $app -Force
# generator credentials: the repo copy wins when present; otherwise keep the deployed one
if (Test-Path (Join-Path $src ".env")) { Copy-Item (Join-Path $src ".env") $app -Force }
# content packs: copy new files from the repo but never delete what the deployed app saved
if (Test-Path (Join-Path $src "content")) {
  robocopy (Join-Path $src "content") (Join-Path $app "content") /E /XO /NFL /NDL /NJH /NJS | Out-Null
}
foreach ($d in @("content", "data")) { New-Item -ItemType Directory -Force -Path (Join-Path $app $d) | Out-Null }

Write-Host "== installing production deps =="
Push-Location $app
npm install --omit=dev --no-audit --no-fund --silent | Out-Null
Pop-Location

Stop-Server
Write-Host "== starting on port $Port =="
$env:PORT = "$Port"
if ($MaxGames -gt 0) { $env:MAX_GAMES = "$MaxGames" }
if ($env:MAX_GAMES) { Write-Host "MAX_GAMES = $env:MAX_GAMES" } else { Write-Host "MAX_GAMES = 50 (server default)" }
$p = Start-Process -FilePath "node" -ArgumentList "server/index.js" -WorkingDirectory $app -WindowStyle Hidden -PassThru
$p.Id | Out-File $pidFile
Start-Sleep -Seconds 2
try {
  $code = (Invoke-WebRequest -UseBasicParsing "http://localhost:$Port/" -TimeoutSec 5).StatusCode
  $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" } | Select-Object -First 1).IPAddress
  Write-Host "HTTP $code  ->  http://localhost:$Port   (LAN: http://$ip`:$Port)   pid $($p.Id)"
} catch {
  Write-Host "server did not answer on $Port; check $app\server with: node server/index.js"
  exit 1
}
