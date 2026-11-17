<#
.SYNOPSIS
  Installs and starts Studio Social.
.DESCRIPTION
  Checks Node.js 24+, installs runtime dependencies (there are none today; dev tools are skipped),
  creates .env from .env.example on first run (demo mode) and starts the server.
  The server prints the login URL with the access key; the browser is opened on it automatically.
.PARAMETER Port
  Port to listen on. Overrides PORT from .env.
.PARAMETER Live
  Sets DEMO=false for this run (real generation and publishing; needs keys saved in the dashboard or .env).
.PARAMETER NoBrowser
  Do not open the browser.
.PARAMETER WithDevTools
  Also install the Playwright test tooling.
#>
[CmdletBinding()]
param(
  [int]$Port,
  [switch]$Live,
  [switch]$NoBrowser,
  [switch]$WithDevTools
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

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

if ($Port) { $env:PORT = "$Port" }
if ($Live) { $env:DEMO = 'false' }

# Resolve the port that will be used: environment first, then .env, then default
$effective = $env:PORT
if (-not $effective) {
  $line = Select-String -Path .env -Pattern '^\s*PORT\s*=\s*(\d+)' | Select-Object -First 1
  $effective = if ($line) { $line.Matches[0].Groups[1].Value } else { '3000' }
}

# Open the browser on the login URL once the server has written the key and is listening
if (-not $NoBrowser) {
  $keyFile = Join-Path $PSScriptRoot '.data\access.key'
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
