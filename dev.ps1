#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Start WordSprout locally: Azure Functions API on :7071 + Vite dev server on :5173.

.DESCRIPTION
    - Checks for Node.js and Azure Functions Core Tools
    - Ensures local.settings.json exists in api/ (copies from .example if missing)
    - Installs npm dependencies if node_modules are absent
    - Launches the API (func start) and frontend (vite dev) in separate windows
    - Both run in APP_ENV=local mode: auth is bypassed, Cosmos DB is in-memory

.EXAMPLE
    .\dev.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root    = $PSScriptRoot
$apiDir  = Join-Path $root 'api'
$frontDir = Join-Path $root 'frontend'

# ─── Helpers ──────────────────────────────────────────────────────────────────

function Require-Command ($cmd, $hint) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Error "Required command '$cmd' not found. $hint"
        exit 1
    }
}

function Ensure-Deps ($dir) {
    $nm = Join-Path $dir 'node_modules'
    if (-not (Test-Path $nm)) {
        Write-Host "  Installing npm deps in $dir ..." -ForegroundColor Cyan
        Push-Location $dir
        npm install --legacy-peer-deps 2>&1 | Select-Object -Last 5
        Pop-Location
    }
}

# ─── Prerequisite checks ──────────────────────────────────────────────────────

Write-Host ""
Write-Host "WordSprout local dev" -ForegroundColor Magenta
Write-Host "──────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

Require-Command node  "Install Node.js from https://nodejs.org"
Require-Command npm   "Install Node.js from https://nodejs.org"
Require-Command func  "Install Azure Functions Core Tools: npm install -g azure-functions-core-tools@4 --unsafe-perm true"

Write-Host "✓ Node $(node --version)  npm $(npm --version)  func $(func --version)" -ForegroundColor Green

# ─── Ensure local.settings.json ───────────────────────────────────────────────

$settings     = Join-Path $apiDir 'local.settings.json'
$settingsEx   = Join-Path $apiDir 'local.settings.json.example'

if (-not (Test-Path $settings)) {
    if (Test-Path $settingsEx) {
        Copy-Item $settingsEx $settings
        Write-Host "✓ Created api/local.settings.json from .example" -ForegroundColor Yellow
        Write-Host "  (APP_ENV is set to 'local' — auth and Cosmos DB are mocked, no Azure needed)" -ForegroundColor DarkGray
    } else {
        Write-Error "api/local.settings.json not found and no .example to copy from."
        exit 1
    }
}

# ─── Install dependencies if needed ──────────────────────────────────────────

Write-Host ""
Write-Host "Checking dependencies..." -ForegroundColor Cyan
Ensure-Deps $apiDir
Ensure-Deps $frontDir
Write-Host "✓ Dependencies ready" -ForegroundColor Green

# ─── Launch API in a new window ───────────────────────────────────────────────

Write-Host ""
Write-Host "Starting API  →  http://localhost:7071/api" -ForegroundColor Cyan
$apiCmd = "Set-Location '$apiDir'; Write-Host 'API: building TypeScript...' -ForegroundColor Cyan; npm run build; Write-Host 'API: starting func host...' -ForegroundColor Green; func start"
Start-Process pwsh -ArgumentList "-NoExit", "-Command", $apiCmd

# ─── Launch frontend dev server in a new window ───────────────────────────────

Write-Host "Starting UI   →  http://localhost:5173" -ForegroundColor Cyan
$uiCmd = "Set-Location '$frontDir'; npm run dev"
Start-Process pwsh -ArgumentList "-NoExit", "-Command", $uiCmd

# ─── Done ─────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "Both servers are starting in separate windows." -ForegroundColor Green
Write-Host ""
Write-Host "  UI  →  http://localhost:5173    (Vite, hot-reload)" -ForegroundColor White
Write-Host "  API →  http://localhost:7071    (Azure Functions)" -ForegroundColor White
Write-Host ""
Write-Host "In LOCAL mode:" -ForegroundColor DarkGray
Write-Host "  · Authentication is bypassed (auto-signed in as dev@local)" -ForegroundColor DarkGray
Write-Host "  · Cosmos DB is an in-memory mock (data resets on API restart)" -ForegroundColor DarkGray
Write-Host "  · AI enrichment returns fixture data (no Azure AI key needed)" -ForegroundColor DarkGray
Write-Host ""
