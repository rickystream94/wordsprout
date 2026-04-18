#Requires -Version 7.0
<#
.SYNOPSIS
    Creates Microsoft Entra ID app registrations for WordSprout DEV and/or PROD,
    then writes the client IDs to infra/config.json.

.DESCRIPTION
    Automates runbook §1 — replaces the manual portal steps for registering
    WordSprout as a Single-Page Application in Entra ID.

    App registrations are created in the tenant defined in infra/config.json
    (3482ae78-3e1a-4c24-ad03-97b471015836) with:
      - Audience: AzureADandPersonalMicrosoftAccount (any org + personal accounts)
      - SPA redirect URIs for the relevant environment(s)

    You must be logged in to Azure CLI:
        az login --tenant 3482ae78-3e1a-4c24-ad03-97b471015836

.PARAMETER Environment
    Which environment(s) to create registrations for. Accepts: dev, prod, both.
    Defaults to both.

.EXAMPLE
    .\scripts\setup-entra-apps.ps1

.EXAMPLE
    .\scripts\setup-entra-apps.ps1 -Environment dev
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet('dev', 'prod', 'both')]
    [string] $Environment = 'both'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

$ScriptRoot = $PSScriptRoot
$RepoRoot   = Split-Path $ScriptRoot -Parent
$ConfigPath = Join-Path $RepoRoot 'infra' 'config.json'
$Config     = Get-Content $ConfigPath -Raw | ConvertFrom-Json

$TenantId = $Config.tenantId

# ─── Helpers ─────────────────────────────────────────────────────────────────

function Write-Step    { param([string]$m) Write-Host "`n── $m" -ForegroundColor Cyan }
function Write-Success { param([string]$m) Write-Host "✓ $m" -ForegroundColor Green }

# ─── Verify tenant ────────────────────────────────────────────────────────────

Write-Step 'Verifying Azure tenant'

$account = az account show --output json 2>&1 | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) {
    Write-Error "Not logged in. Run: az login --tenant $TenantId"
    exit 1
}
if ($account.tenantId -ne $TenantId) {
    Write-Error "Wrong tenant.`n  Expected: $TenantId`n  Current:  $($account.tenantId)`nRun: az login --tenant $TenantId"
    exit 1
}

Write-Success "Tenant: $TenantId"

# ─── Register app for a given environment ─────────────────────────────────────

function Register-EntraApp {
    param(
        [string] $Env,
        [string[]] $RedirectUris
    )

    $envConfig = $Config.environments.$Env
    $appName   = $envConfig.entraAppName

    Write-Step "Registering app '$appName' ($Env)"

    # Check if app already exists
    $existingApps = az ad app list --display-name $appName --output json | ConvertFrom-Json

    if ($existingApps.Count -gt 0) {
        $app = $existingApps[0]
        Write-Host "  App '$appName' already exists — client ID: $($app.appId)" -ForegroundColor Yellow
    } else {
        # Create app registration — multitenant + personal Microsoft accounts
        $app = az ad app create `
            --display-name $appName `
            --sign-in-audience 'AzureADandPersonalMicrosoftAccount' `
            --output json | ConvertFrom-Json

        Write-Success "App registration created: $($app.appId)"
    }

    # Configure SPA redirect URIs via Graph API (az ad app create doesn't support SPA URIs)
    Write-Host "  Setting SPA redirect URIs: $($RedirectUris -join ', ')" -ForegroundColor DarkGray

    $spaPayload = @{
        spa = @{
            redirectUris = $RedirectUris
        }
    } | ConvertTo-Json -Compress -Depth 5

    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        $spaPayload | Set-Content $tmp -Encoding utf8
        az rest --method PATCH `
            --uri "https://graph.microsoft.com/v1.0/applications/$($app.id)" `
            --headers 'Content-Type=application/json' `
            --body "@$tmp" | Out-Null
    } finally {
        Remove-Item $tmp -ErrorAction SilentlyContinue
    }

    Write-Success "SPA redirect URIs configured"

    # Write client ID back to config.json
    $Config.environments.$Env.entraClientId = $app.appId
    Write-Success "config.json updated: environments.$Env.entraClientId = $($app.appId)"

    return $app.appId
}

# ─── Run for selected environment(s) ─────────────────────────────────────────

$devUris  = @(
    'http://localhost:5173',
    "https://$($Config.environments.dev.swaName).azurestaticapps.net"
)
$prodUris = @(
    # Placeholder — update after first PROD deploy with the actual SWA hostname.
    # Run: az staticwebapp show --name $cfg.environments.prod.swaName --query properties.defaultHostname
    "https://$($Config.environments.prod.swaName).azurestaticapps.net"
)

if ($Environment -eq 'dev' -or $Environment -eq 'both') {
    Register-EntraApp -Env 'dev' -RedirectUris $devUris | Out-Null
}

if ($Environment -eq 'prod' -or $Environment -eq 'both') {
    Register-EntraApp -Env 'prod' -RedirectUris $prodUris | Out-Null
}

# ─── Persist config.json ──────────────────────────────────────────────────────

$Config | ConvertTo-Json -Depth 10 | Set-Content $ConfigPath -Encoding utf8
Write-Success 'infra/config.json saved'

# ─── Summary ─────────────────────────────────────────────────────────────────

Write-Host ''
Write-Host '════════════════════════════════════════════════════' -ForegroundColor Green
Write-Host ' Entra ID app registration setup complete!' -ForegroundColor Green
Write-Host '════════════════════════════════════════════════════' -ForegroundColor Green
Write-Host ''

if ($Environment -eq 'dev' -or $Environment -eq 'both') {
    Write-Host "  DEV client ID : $($Config.environments.dev.entraClientId)" -ForegroundColor Yellow
}
if ($Environment -eq 'prod' -or $Environment -eq 'both') {
    Write-Host "  PROD client ID: $($Config.environments.prod.entraClientId)" -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Next steps:' -ForegroundColor Cyan
Write-Host '  1. Copy frontend/.env.dev.example to frontend/.env.dev and fill in VITE_ENTRA_CLIENT_ID'
Write-Host '  2. Run .\scripts\deploy-dev.ps1 (reads EntraClientId from config.json automatically)'
if ($Environment -eq 'prod' -or $Environment -eq 'both') {
    Write-Host '  3. Set PROD_VITE_ENTRA_CLIENT_ID as a GitHub Actions Variable'
    Write-Host '  4. After first PROD deploy, update the PROD redirect URI in the app registration:'
    Write-Host "       Azure Portal -> Entra ID -> App registrations -> wordsprout-prod -> Authentication" -ForegroundColor DarkGray
}
Write-Host ''
