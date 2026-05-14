#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Seed the local Cosmos DB mock with synthetic vocabulary data.

.DESCRIPTION
    Generates phrasebooks, entries, and enrichments in api/.cosmos-mock.json.
    If -UserId is omitted, auto-discovers it from the existing mock file.
    The frontend auto-pulls from the API on load — only the backend needs seeding.

.PARAMETER UserId
    OAuth subject ID (the "userId" field in Cosmos documents).
    If omitted, extracted from the first document in api/.cosmos-mock.json.

.EXAMPLE
    .\scripts\seed-local.ps1 -UserId "abc123"

.EXAMPLE
    # Auto-discover userId from existing mock data
    .\scripts\seed-local.ps1
#>
param(
    [string]$UserId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root    = $PSScriptRoot | Split-Path
$mockFile = Join-Path $root 'api' '.cosmos-mock.json'

# ─── Auto-discover userId if not provided ─────────────────────────────────────

if (-not $UserId) {
    if (Test-Path $mockFile) {
        Write-Host "No -UserId specified. Attempting auto-discovery from $mockFile ..." -ForegroundColor Cyan
        $raw = Get-Content $mockFile -Raw | ConvertFrom-Json
        foreach ($pair in $raw) {
            # Each item is an array [id, document]
            $doc = $pair[1]
            if ($doc.userId -and $doc.userId -notlike '_*') {
                $UserId = $doc.userId
                Write-Host "  Found userId: $UserId" -ForegroundColor Green
                break
            }
        }
    }

    if (-not $UserId) {
        Write-Error "Could not auto-discover userId. Log in to the app once (creates .cosmos-mock.json), then re-run, or pass -UserId explicitly."
        exit 1
    }
}

# ─── Run the TypeScript seed script ──────────────────────────────────────────

Write-Host ""
Write-Host "Seeding local data for userId=$UserId ..." -ForegroundColor Cyan
Write-Host ""

Push-Location $root
try {
    npx tsx scripts/seed-local.ts --userId $UserId
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Seed script failed with exit code $LASTEXITCODE"
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Done! Refresh your browser to see the seeded data." -ForegroundColor Green
Write-Host ""
