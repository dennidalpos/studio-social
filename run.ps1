<#
.SYNOPSIS
  Installs and starts Studio Social.
.DESCRIPTION
  Checks Node.js 24+, installs runtime dependencies (dev tools are skipped), creates .env from
  .env.example on first run (demo mode) and starts the server. If Studio Social instances are
  already running, they are listed and a menu lets you stop them, open them or pick another port.
  The server prints the login URL with the access key; the browser is opened on it automatically.
.PARAMETER Port
  Port to listen on. Overrides PORT from .env.
.PARAMETER Live
  Sets DEMO=false for this run (real generation and publishing; needs keys saved in the dashboard or .env).
.PARAMETER NoBrowser
  Do not open the browser.
.PARAMETER WithDevTools
  Also install the Playwright test tooling.
.PARAMETER StopExisting
  Stop every running instance without asking, then start.
#>
[CmdletBinding()]
param(
  [int]$Port,
  [switch]$Live,
  [switch]$NoBrowser,
  [switch]$WithDevTools,
  [switch]$StopExisting
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$keyFile = Join-Path $PSScriptRoot '.data\access.key'

function Get-Instances {
  $listening = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue)
  @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'server\.mjs' } |
    ForEach-Object {
      $id = $_.ProcessId
      [pscustomobject]@{
        Pid     = $id
        Port    = (($listening | Where-Object OwningProcess -eq $id | Select-Object -ExpandProperty LocalPort -Unique) -join ', ')
        Started = $_.CreationDate
      }
    })
}

function Get-PortOwner([int]$port) {
  $connection = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $connection) { return $null }
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($connection.OwningProcess)" -ErrorAction SilentlyContinue
  [pscustomobject]@{ Pid = $connection.OwningProcess; Name = $process.Name; Command = $process.CommandLine }
}

function Get-FreePort([int]$from) {
  while (Get-NetTCPConnection -LocalPort $from -State Listen -ErrorAction SilentlyContinue) { $from++ }
  $from
}

function Open-Instance([int]$port) {
  $key = if (Test-Path $keyFile) { (Get-Content -LiteralPath $keyFile -Raw).Trim() } else { '' }
  Start-Process $(if ($key) { "http://localhost:$port/?key=$key" } else { "http://localhost:$port/" })
}

# Numbered menu: Up/Down (or Home/End) move the highlight, Enter selects, 1-9 select directly,
# Esc cancels (returns -1).
function Select-Menu([string]$title, [string[]]$items) {
  Write-Host $title -ForegroundColor Cyan
  foreach ($item in $items) { Write-Host '' }
  $top = [Console]::CursorTop - $items.Count
  $width = [Math]::Max(20, [Console]::WindowWidth - 1)
  $index = 0
  [Console]::CursorVisible = $false
  try {
    while ($true) {
      [Console]::SetCursorPosition(0, $top)
      for ($i = 0; $i -lt $items.Count; $i++) {
        $text = ('{0} {1}. {2}' -f $(if ($i -eq $index) { '>' } else { ' ' }), ($i + 1), $items[$i])
        if ($text.Length -gt $width) { $text = $text.Substring(0, $width) }
        if ($i -eq $index) { Write-Host $text.PadRight($width) -ForegroundColor Black -BackgroundColor Gray }
        else { Write-Host $text.PadRight($width) }
      }
      $key = [Console]::ReadKey($true)
      switch ($key.Key) {
        'UpArrow'   { $index = ($index + $items.Count - 1) % $items.Count }
        'DownArrow' { $index = ($index + 1) % $items.Count }
        'Home'      { $index = 0 }
        'End'       { $index = $items.Count - 1 }
        'Enter'     { return $index }
        'Escape'    { return -1 }
        default {
          $digit = [string]$key.KeyChar
          if ($digit -match '^[1-9]$' -and [int]$digit -le $items.Count) { return [int]$digit - 1 }
        }
      }
    }
  } finally { [Console]::CursorVisible = $true }
}


# Node.js 24 or later
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  throw 'Node.js was not found. Install version 24 or later from https://nodejs.org/ and run this script again.'
}
$major = [int](($node.Version.ToString() -split '\.')[0])
if ($major -lt 24) {
  throw "Node.js $($node.Version) is too old. Version 24 or later is required."
}

# Dependencies
if (-not (Test-Path node_modules) -or $WithDevTools) {
  $flags = if ($WithDevTools) { @() } else { @('--omit=dev') }
  Write-Host 'Installing dependencies...'
  & npm ci @flags
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
}

# First-run configuration: demo mode, nothing is sent to real services
if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  Write-Host 'Created .env from .env.example (demo mode).'
}

if ($Live) { $env:DEMO = 'false' }
if ($Port) { $env:PORT = "$Port" }

# Resolve the port that will be used: environment first, then .env, then default
$effective = $env:PORT
if (-not $effective) {
  $line = Select-String -Path .env -Pattern '^\s*PORT\s*=\s*(\d+)' | Select-Object -First 1
  $effective = if ($line) { $line.Matches[0].Groups[1].Value } else { '3000' }
}
$effective = [int]$effective

# Instances already running
if ($StopExisting) {
  foreach ($instance in Get-Instances) { Stop-Process -Id $instance.Pid -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 500
}

while ($true) {
  $instances = Get-Instances
  $owner = Get-PortOwner $effective
  if (-not $instances -and -not $owner) { break }

  Write-Host ''
  if ($instances) {
    Write-Host 'Studio Social instances already running:' -ForegroundColor Cyan
    foreach ($item in $instances) {
      Write-Host ('  PID {0}  port {1}  started {2:g}' -f $item.Pid, $(if ($item.Port) { $item.Port } else { '?' }), $item.Started)
    }
  }
  if ($owner -and ($instances.Pid -notcontains $owner.Pid)) {
    Write-Host "Port $effective is used by another program: PID $($owner.Pid) $($owner.Name)" -ForegroundColor Yellow
  }

  if ([Console]::IsInputRedirected) {
    Write-Host 'No terminal to ask. Use -StopExisting or -Port <port>.'
    exit 1
  }

  $options = @()
  foreach ($item in $instances) { $options += [pscustomobject]@{ Label = "Stop instance PID $($item.Pid) (port $($item.Port))"; Action = 'stop'; Target = $item } }
  if ($instances.Count -gt 1) { $options += [pscustomobject]@{ Label = 'Stop all instances'; Action = 'stopall'; Target = $null } }
  if ($instances | Where-Object Port) { $options += [pscustomobject]@{ Label = 'Open an instance in the browser'; Action = 'open'; Target = $null } }
  $options += [pscustomobject]@{ Label = "Use another port (now $effective)"; Action = 'port'; Target = $null }
  if (-not $owner) { $options += [pscustomobject]@{ Label = 'Continue and start a new instance'; Action = 'continue'; Target = $null } }
  $options += [pscustomobject]@{ Label = 'Quit'; Action = 'quit'; Target = $null }

  $picked = Select-Menu 'What do you want to do?' @($options.Label)
  if ($picked -lt 0) { exit 0 }
  $option = $options[$picked]

  switch ($option.Action) {
    'quit' { exit 0 }
    'continue' { break }
    'stop' {
      Stop-Process -Id $option.Target.Pid -Force -ErrorAction SilentlyContinue
      Start-Sleep -Milliseconds 500
    }
    'stopall' {
      foreach ($item in $instances) { Stop-Process -Id $item.Pid -Force -ErrorAction SilentlyContinue }
      Start-Sleep -Milliseconds 500
    }
    'open' {
      $withPort = @($instances | Where-Object Port)
      $which = if ($withPort.Count -eq 1) { 0 } else { Select-Menu 'Open which instance?' @($withPort | ForEach-Object { "PID $($_.Pid) (port $($_.Port))" }) }
      if ($which -ge 0) { Open-Instance ([int]($withPort[$which].Port -split ',')[0]) }
    }
    'port' {
      $suggested = Get-FreePort ($effective + 1)
      $answer = Read-Host "Port [$suggested]"
      $effective = if ($answer -match '^\d{2,5}$') { [int]$answer } else { $suggested }
      $env:PORT = "$effective"
    }
  }
  if ($option.Action -eq 'continue') { break }
}
$env:PORT = "$effective"

# Open the browser on the login URL once the server has written the key and is listening
if (-not $NoBrowser) {
  Start-Job -ArgumentList $effective, $keyFile -ScriptBlock {
    param($port, $keyFile)
    for ($i = 0; $i -lt 60; $i++) {
      Start-Sleep -Milliseconds 500
      try {
        $client = [System.Net.Sockets.TcpClient]::new('127.0.0.1', [int]$port)
        $client.Close()
        if (Test-Path $keyFile) {
          $key = (Get-Content -LiteralPath $keyFile -Raw).Trim()
          Start-Process "http://localhost:$port/?key=$key"
          return
        }
      } catch { }
    }
  } | Out-Null
}

Write-Host "Starting Studio Social on http://localhost:$effective (Ctrl+C to stop)..."
try {
  & npm start
} finally {
  Get-Job | Stop-Job -ErrorAction SilentlyContinue
  Get-Job | Remove-Job -Force -ErrorAction SilentlyContinue
}
