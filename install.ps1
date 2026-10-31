# MU/TH/UR one-command installer for Windows (PowerShell 5.1 and 7).
#
#   irm https://raw.githubusercontent.com/Neuron89/aliens/expandable-system/install.ps1 | iex
#
# or, from a cloned repo:  powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 [-Firewall]
#
# Installs into %LOCALAPPDATA%\MUTHUR (override with $env:MUTHUR_HOME), builds the app,
# writes "Start MUTHUR.cmd" / "Stop MUTHUR.cmd", adds a Desktop shortcut and starts the
# server on port 3100 (override with $env:MUTHUR_PORT). Re-run it any time to update:
# saved sessions, portraits and imported packs live in <install dir>\data and are kept.
# No admin rights needed. Optional environment switches:
#   MUTHUR_BRANCH=main      install another branch
#   MUTHUR_FIREWALL=1       same as -Firewall: ask (UAC) to open the port for phones
#   MUTHUR_NO_START=1       do not start the server at the end
#   MUTHUR_NO_BROWSER=1     do not open the browser
#   MUTHUR_NO_SHORTCUT=1    do not create the Desktop shortcut
# Everything lives inside one function so `irm | iex` never leaks variables or closes the window.

function Install-Muthur {
  param([switch]$Firewall)

  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'   # the PS 5.1 progress bar makes downloads crawl
  try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }

  # ---------------------------------------------------------------- settings
  $Repo   = 'Neuron89/aliens'
  $Branch = 'expandable-system'
  if ($env:MUTHUR_BRANCH) { $Branch = $env:MUTHUR_BRANCH }
  $Port = 3100
  if ($env:MUTHUR_PORT) { $Port = [int]$env:MUTHUR_PORT }
  $Root = Join-Path $env:LOCALAPPDATA 'MUTHUR'
  if ($env:MUTHUR_HOME) { $Root = $env:MUTHUR_HOME }
  if ($env:MUTHUR_FIREWALL -eq '1') { $Firewall = $true }
  $ZipUrl = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"
  $App    = Join-Path $Root 'app'
  $Data   = Join-Path $Root 'data'
  $Logs   = Join-Path $Root 'logs'

  function Say([string]$msg)  { Write-Host "  $msg" }
  function Step([string]$msg) { Write-Host ''; Write-Host "==> $msg" -ForegroundColor Cyan }
  function Good([string]$msg) { Write-Host "  $msg" -ForegroundColor Green }
  function Warn([string]$msg) { Write-Host "  $msg" -ForegroundColor Yellow }

  Write-Host ''
  Write-Host '  MU/TH/UR 6000 :: game terminal installer' -ForegroundColor Green
  Write-Host "  install folder : $Root"
  Write-Host "  port           : $Port"

  # ---------------------------------------------------------------- Node.js
  function Find-Node {
    $cands = @()
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cmd) { $cands += $cmd.Path }
    $cands += (Join-Path $env:ProgramFiles 'nodejs\node.exe')
    if ($env:LOCALAPPDATA) { $cands += (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe') }
    foreach ($c in $cands) { if ($c -and (Test-Path $c)) { return $c } }
    return $null
  }
  function Get-NodeMajor([string]$node) {
    try { $v = (& $node -v) 2>$null } catch { return 0 }
    if ("$v" -match '^v(\d+)\.') { return [int]$Matches[1] }
    return 0
  }

  Step 'Checking for Node.js 20 or newer'
  $node = Find-Node
  $major = 0
  if ($node) { $major = Get-NodeMajor $node }
  if ($major -lt 20) {
    if ($node) { Warn "Found Node.js $major at $node; it is too old." } else { Warn 'Node.js is not installed.' }
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if ($winget) {
      Say 'Installing Node.js LTS with winget (Windows may ask for permission)...'
      $ErrorActionPreference = 'Continue'
      & winget.exe install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
      $ErrorActionPreference = 'Stop'
      $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
      $node = Find-Node
      if ($node) { $major = Get-NodeMajor $node }
    }
    if ($major -lt 20) {
      Write-Host ''
      Warn 'Please install Node.js (the "LTS" button) from https://nodejs.org/en/download'
      Warn 'then close this window, open a new PowerShell and run the install command again.'
      return $false
    }
  }
  $nodeDir = Split-Path -Parent $node
  $npm = Join-Path $nodeDir 'npm.cmd'
  if (-not (Test-Path $npm)) { throw "npm.cmd was not found next to $node. Reinstall Node.js from https://nodejs.org" }
  if (($env:Path -split ';') -notcontains $nodeDir) { $env:Path = "$nodeDir;$env:Path" }
  Good "Node.js $(& $node -v) ($node)"

  # ---------------------------------------------------------------- stop a running copy
  New-Item -ItemType Directory -Force -Path $Root, $Data, (Join-Path $Data 'content'), $Logs | Out-Null
  $pidFile = Join-Path $Root 'server.pid'
  if (Test-Path $pidFile) {
    $old = Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ("$old" -match '^\d+$') {
      $proc = Get-Process -Id ([int]$old) -ErrorAction SilentlyContinue
      if ($proc -and $proc.ProcessName -eq 'node') {
        Step 'Stopping the running MUTHUR server'
        Stop-Process -Id $proc.Id -Force
        Wait-Process -Id $proc.Id -Timeout 15 -ErrorAction SilentlyContinue
        Good "stopped (pid $($proc.Id))"
      }
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  }

  # ---------------------------------------------------------------- get the source
  # Running from a checkout (install.ps1 next to "web app")? Use it instead of downloading.
  $src = $null
  $tmp = Join-Path $Root '_download'
  $scriptPath = $PSCommandPath
  if (-not $scriptPath) { $scriptPath = $MyInvocation.ScriptName }
  if ($scriptPath) {
    $here = Split-Path -Parent $scriptPath
    if ($here -and (Test-Path (Join-Path $here 'web app\package.json'))) { $src = Join-Path $here 'web app' }
  }
  if ($src) {
    Step "Using the local checkout: $src"
  } else {
    Step "Downloading MU/TH/UR ($Branch branch)"
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    $zip = Join-Path $tmp 'source.zip'
    Say $ZipUrl
    Invoke-WebRequest -UseBasicParsing -Uri $ZipUrl -OutFile $zip
    Say ('downloaded {0:N1} MB, unpacking...' -f ((Get-Item $zip).Length / 1MB))
    $out = Join-Path $tmp 'x'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($zip, $out)
    $top = Get-ChildItem $out -Directory | Select-Object -First 1
    if (-not $top -or -not (Test-Path (Join-Path $top.FullName 'web app\package.json'))) { throw 'The download did not contain "web app\package.json".' }
    $src = Join-Path $top.FullName 'web app'
  }

  Step "Copying the app into $App"
  # Mirror the source but keep node_modules (faster updates); never copy local build output,
  # runtime data, content packs or secrets from a checkout.
  $rc = @($src, $App, '/MIR', '/XD', 'node_modules', (Join-Path $src 'dist'), (Join-Path $src 'data'), (Join-Path $src 'content'), (Join-Path $src '.vite'),
          '/XF', '.env', '.env.local', '*.log', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:2', '/W:1')
  & robocopy.exe @rc | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Copying files failed (robocopy exit code $LASTEXITCODE)." }
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
  Good 'files in place'

  # ---------------------------------------------------------------- npm install + build
  function Invoke-Npm([string]$what, [string[]]$npmArgs, [string]$logName) {
    $log = Join-Path $Logs $logName
    Say "$what (log: $log)"
    $eap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'   # npm writes warnings to stderr; only the exit code matters
    Push-Location $App
    try {
      & $npm @npmArgs 2>&1 | ForEach-Object { "$_" } | Out-File -FilePath $log -Encoding utf8
      $code = $LASTEXITCODE
    } finally {
      Pop-Location
      $ErrorActionPreference = $eap
    }
    if ($code -ne 0) {
      Get-Content $log -Tail 25 | ForEach-Object { Write-Host "    $_" }
      throw "$what failed (exit code $code). Full log: $log"
    }
  }

  Step 'Installing packages (first time takes a few minutes)'
  Invoke-Npm 'npm install' @('install', '--no-audit', '--no-fund', '--loglevel=error') 'npm-install.log'
  Good 'packages installed'
  Step 'Building the client'
  Invoke-Npm 'npm run build' @('run', 'build') 'build.log'
  if (-not (Test-Path (Join-Path $App 'dist\index.html'))) { throw "The build finished but dist\index.html is missing. See $(Join-Path $Logs 'build.log')" }
  Good 'client built'

  # ---------------------------------------------------------------- launchers
  Step 'Writing launchers'
  $launcher = @'
# MUTHUR launcher (written by install.ps1; re-running the installer overwrites it).
# Usage: muthur.ps1 start | stop | status | firewall
param([string]$Action = 'start', [int]$Port = 0)
$ErrorActionPreference = 'Stop'
$Root    = $PSScriptRoot
$App     = Join-Path $Root 'app'
$Data    = Join-Path $Root 'data'
$PidFile = Join-Path $Root 'server.pid'
$Log     = Join-Path $Root 'logs\server.log'
if ($Port -le 0) { $Port = __PORT__; if ($env:MUTHUR_PORT) { $Port = [int]$env:MUTHUR_PORT } }
$Rule = "MUTHUR-TCP-$Port"

function Find-Node {
  $c = Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { return $c.Path }
  foreach ($p in @((Join-Path $env:ProgramFiles 'nodejs\node.exe'), '__NODE__')) { if (Test-Path $p) { return $p } }
  return $null
}
function Get-RunningPid {
  if (-not (Test-Path $PidFile)) { return $null }
  $p = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ("$p" -notmatch '^\d+$') { return $null }
  $proc = Get-Process -Id ([int]$p) -ErrorAction SilentlyContinue
  if ($proc -and $proc.ProcessName -eq 'node') { return [int]$p }
  return $null
}
function Test-Answers {
  try { $null = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/" -TimeoutSec 2; return $true } catch { return $false }
}
function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  return ([Security.Principal.WindowsPrincipal]$id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
function Test-FirewallRule {
  $eap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  $null = & netsh.exe advfirewall firewall show rule name=$Rule 2>$null
  $ok = ($LASTEXITCODE -eq 0); $ErrorActionPreference = $eap
  return $ok
}
function Get-LanIP {
  $best = $null; $bestScore = -1
  foreach ($ni in [Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
    if ($ni.OperationalStatus -ne 'Up' -or $ni.NetworkInterfaceType -eq 'Loopback') { continue }
    $props = $ni.GetIPProperties()
    $gw = @($props.GatewayAddresses | Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' -and $_.Address.ToString() -ne '0.0.0.0' }).Count -gt 0
    foreach ($ua in $props.UnicastAddresses) {
      if ($ua.Address.AddressFamily -ne 'InterNetwork') { continue }
      $ip = $ua.Address.ToString()
      if ($ip -like '127.*' -or $ip -like '169.254.*') { continue }
      $score = 0
      if ($gw) { $score += 2 }
      if ($ip -match '^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)') { $score += 1 }
      if ($score -gt $bestScore) { $best = $ip; $bestScore = $score }
    }
  }
  return $best
}
function Show-Tail { if (Test-Path $Log) { Get-Content $Log -Tail 15 | ForEach-Object { Write-Host "    $_" } } }

function Stop-Muthur {
  $p = Get-RunningPid
  if ($p) {
    Stop-Process -Id $p -Force
    Wait-Process -Id $p -Timeout 15 -ErrorAction SilentlyContinue
    Write-Host "  MUTHUR server stopped (pid $p)." -ForegroundColor Green
  } else {
    Write-Host '  MUTHUR server is not running.'
  }
  if (Test-Path $PidFile) { Remove-Item $PidFile -Force }
}

function Add-FirewallRule {
  if (Test-FirewallRule) { Write-Host "  Firewall already allows port $Port (rule $Rule)." -ForegroundColor Green; return }
  if (Test-Admin) {
    $eap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    & netsh.exe advfirewall firewall add rule name=$Rule dir=in action=allow protocol=TCP localport=$Port profile=any | Out-Null
    $ErrorActionPreference = $eap
    if (Test-FirewallRule) { Write-Host "  Firewall rule $Rule added: phones can reach port $Port." -ForegroundColor Green }
    else { Write-Host '  Could not add the firewall rule.' -ForegroundColor Yellow }
    return
  }
  Write-Host '  Asking Windows for permission (UAC) to open the port for phones...'
  $exe = (Get-Process -Id $PID).Path
  try {
    Start-Process -FilePath $exe -Verb RunAs -Wait -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", 'firewall', '-Port', "$Port")
  } catch {
    Write-Host '  Permission was not granted; phones may not be able to connect.' -ForegroundColor Yellow
    return
  }
  if (Test-FirewallRule) { Write-Host "  Firewall rule $Rule added." -ForegroundColor Green }
}

function Show-Urls {
  $ip = Get-LanIP
  if (-not $ip) { $ip = '<this-PC-IP>' }
  Write-Host ''
  Write-Host '  MU/TH/UR is running.' -ForegroundColor Green
  Write-Host "    GM (this computer) : http://localhost:$Port"
  Write-Host "    GM (tablet)        : http://${ip}:$Port"
  Write-Host "    TV / table screen  : http://${ip}:$Port/tv"
  Write-Host "    Players' phones    : http://${ip}:$Port  -> JOIN -> type the code the GM screen shows"
  Write-Host '    (every device must be on the same Wi-Fi as this computer)'
  if (-not (Test-FirewallRule)) {
    Write-Host ''
    Write-Host "  Phones can't connect? Double-click 'Allow Phones (Firewall).cmd' in $Root" -ForegroundColor Yellow
  }
  Write-Host ''
  Write-Host "  Stop it with 'Stop MUTHUR.cmd' (in $Root)."
}

function Start-Muthur {
  if (-not (Get-RunningPid)) {
    if (Test-Path $PidFile) { Remove-Item $PidFile -Force }
    $node = Find-Node
    if (-not $node) { throw 'Node.js was not found. Run the installer again.' }
    if (-not (Test-Path (Join-Path $App 'dist\index.html'))) { throw 'The app is not built. Run the installer again.' }
    if (Test-Answers) { throw "Another program already uses port $Port. Close it, or set MUTHUR_PORT to another port." }
    New-Item -ItemType Directory -Force -Path $Data, (Join-Path $Data 'content'), (Split-Path $Log) | Out-Null
    $env:PORT = "$Port"
    $env:DATA_DIR = $Data
    $env:CONTENT_DIR = Join-Path $Data 'content'
    Add-Content -Path $Log -Value "=== start $(Get-Date -Format s) port $Port ==="
    Write-Host "  Starting MUTHUR on port $Port..."
    # cmd wrapper: hidden window that survives this console closing, and output goes to the log
    $line = "/d /c `"`"$node`" server\index.js >> `"$Log`" 2>&1`""
    $wrap = Start-Process -FilePath $env:ComSpec -ArgumentList $line -WorkingDirectory $App -WindowStyle Hidden -PassThru
    $nodePid = $null
    for ($i = 0; $i -lt 50 -and -not $nodePid; $i++) {
      Start-Sleep -Milliseconds 200
      $c = Get-CimInstance Win32_Process -Filter "ParentProcessId=$($wrap.Id) AND Name='node.exe'" -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($c) { $nodePid = [int]$c.ProcessId } elseif ($wrap.HasExited) { break }
    }
    if (-not $nodePid) { Show-Tail; throw "The server did not start. Log: $Log" }
    Set-Content -Path $PidFile -Value $nodePid -Encoding ascii
    $ok = $false
    for ($i = 0; $i -lt 60; $i++) {
      if (Test-Answers) { $ok = $true; break }
      if (-not (Get-Process -Id $nodePid -ErrorAction SilentlyContinue)) { break }
      Start-Sleep -Milliseconds 500
    }
    if (-not $ok) {
      Show-Tail
      if (Get-Process -Id $nodePid -ErrorAction SilentlyContinue) { Stop-Process -Id $nodePid -Force }
      Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
      throw "The server did not answer on port $Port. Log: $Log"
    }
    Write-Host "  server answering (pid $nodePid)" -ForegroundColor Green
    if ($env:MUTHUR_NO_BROWSER -ne '1') { Start-Process "http://localhost:$Port/" }
  } else {
    Write-Host "  Already running (pid $(Get-RunningPid))."
  }
  Show-Urls
}

try {
  switch ($Action.ToLower()) {
    'start'    { Start-Muthur }
    'stop'     { Stop-Muthur }
    'status'   { $p = Get-RunningPid; if ($p) { Write-Host "  running (pid $p) on port $Port"; Show-Urls } else { Write-Host '  not running' } }
    'firewall' { Add-FirewallRule }
    default    { throw "Unknown action '$Action' (use start, stop, status or firewall)." }
  }
  exit 0
} catch {
  Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
'@
  $launcher = $launcher.Replace('__PORT__', "$Port").Replace('__NODE__', $node)
  $launcherPath = Join-Path $Root 'muthur.ps1'
  Set-Content -Path $launcherPath -Value $launcher -Encoding utf8
  # run the launcher in a child PowerShell: works even where script execution is disabled
  $psExe = (Get-Process -Id $PID).Path
  function Invoke-Launcher([string[]]$launcherArgs) {
    $eap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    & $psExe -NoProfile -ExecutionPolicy Bypass -File $launcherPath @launcherArgs | Out-Host
    $code = $LASTEXITCODE; $ErrorActionPreference = $eap
    return $code
  }

  function Write-Cmd([string]$name, [string]$action) {
    $body = "@echo off`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"%~dp0muthur.ps1`" $action`r`nif not defined MUTHUR_NO_PAUSE pause`r`n"
    [IO.File]::WriteAllText((Join-Path $Root $name), $body, [Text.Encoding]::ASCII)
  }
  Write-Cmd 'Start MUTHUR.cmd' 'start'
  Write-Cmd 'Stop MUTHUR.cmd' 'stop'
  Write-Cmd 'Allow Phones (Firewall).cmd' 'firewall'
  Good "Start MUTHUR.cmd, Stop MUTHUR.cmd, Allow Phones (Firewall).cmd in $Root"

  if ($env:MUTHUR_NO_SHORTCUT -ne '1') {
    try {
      $desktop = [Environment]::GetFolderPath('Desktop')
      $sh = New-Object -ComObject WScript.Shell
      $lnk = $sh.CreateShortcut((Join-Path $desktop 'MUTHUR.lnk'))
      $lnk.TargetPath = Join-Path $Root 'Start MUTHUR.cmd'
      $lnk.WorkingDirectory = $Root
      $lnk.Description = 'Start the MU/TH/UR game terminal'
      $lnk.Save()
      Good "Desktop shortcut: $(Join-Path $desktop 'MUTHUR.lnk')"
    } catch { Warn "Could not create the Desktop shortcut ($($_.Exception.Message)); use Start MUTHUR.cmd instead." }
  }

  # ---------------------------------------------------------------- firewall (phones over Wi-Fi)
  Step 'Firewall (so phones can connect)'
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if ($Firewall -or $isAdmin) {
    $null = Invoke-Launcher @('firewall', '-Port', "$Port")
  } else {
    $eap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    $null = & netsh.exe advfirewall firewall show rule name="MUTHUR-TCP-$Port" 2>$null
    $has = ($LASTEXITCODE -eq 0); $ErrorActionPreference = $eap
    if ($has) { Good "port $Port is already allowed" }
    else { Warn "If phones can't connect later, double-click 'Allow Phones (Firewall).cmd' in $Root (asks for admin once)." }
  }

  # ---------------------------------------------------------------- start
  if ($env:MUTHUR_NO_START -ne '1') {
    Step 'Starting the server'
    $code = Invoke-Launcher @('start')
    if ($code -ne 0) { throw 'The server did not start; see the messages above.' }
  }

  Write-Host ''
  Good 'Install complete. Next time: double-click "MUTHUR" on your Desktop.'
  Say  "Update later by running the same install command again (your saved games in $Data are kept)."
  return $true
}

$muthurOk = $false
try {
  $muthurOk = Install-Muthur -Firewall:(@($args) -contains '-Firewall')
} catch {
  Write-Host ''
  Write-Host "  INSTALL FAILED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host '  Send this message to whoever shared the game with you.'
}
# Only set an exit code when run as a file; under `irm | iex` exit would close the window.
if ($PSCommandPath -and -not $muthurOk) { exit 1 }
