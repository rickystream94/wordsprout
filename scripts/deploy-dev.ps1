#Requires -Version 7.0
<#
.SYNOPSIS
    Provisions WordSprout DEV Azure infrastructure (idempotently) and deploys the
    latest frontend + API code.

.DESCRIPTION
    Runs against the DEV resource group defined in infra/config.json
    (environments.dev.resourceGroup).

    Prerequisite: az login targeting the subscription in infra/config.json.
    Run scripts/setup-entra-apps.ps1 first — it populates environments.dev.entraClientId
    in infra/config.json so that -EntraClientId is not required.

.PARAMETER EntraClientId
    Client ID of the wordsprout-dev Entra ID app registration.
    Optional if infra/config.json has environments.dev.entraClientId set (run setup-entra-apps.ps1).

.PARAMETER Location
    Azure region. Defaults to the region in infra/config.json (denmarkeast).

.PARAMETER SkipInfra
    Skip Bicep infrastructure provisioning (steps 3-4). Only deploy app code.

.PARAMETER SkipApp
    Skip app code deployment (steps 5-8). Only provision infrastructure.

.EXAMPLE
    # After running setup-entra-apps.ps1, no parameters are needed
    .\scripts\deploy-dev.ps1

.EXAMPLE
    # Override Entra client ID explicitly if needed
    .\scripts\deploy-dev.ps1 -EntraClientId 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

.EXAMPLE
    .\scripts\deploy-dev.ps1 -SkipInfra
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string] $EntraClientId,

    [Parameter(Mandatory = $false)]
    [string] $Location,

    [switch] $SkipInfra,
    [switch] $SkipApp
)

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

$ScriptRoot = $PSScriptRoot
$RepoRoot   = Split-Path $ScriptRoot -Parent
$Config     = Get-Content (Join-Path $RepoRoot 'infra' 'config.json') -Raw | ConvertFrom-Json
$DevEnv     = $Config.environments.dev

$SubscriptionId   = $Config.subscriptionId
$ResourceGroup    = $DevEnv.resourceGroup
$FuncAppName      = $DevEnv.funcAppName
$SwaName          = $DevEnv.swaName

# Fall back to config.json values when parameters are not supplied
if (-not $EntraClientId) { $EntraClientId = $DevEnv.entraClientId }
if (-not $Location)      { $Location      = $Config.region }

if (-not $EntraClientId) {
    Write-Error "EntraClientId is required. Run scripts/setup-entra-apps.ps1 first, or pass -EntraClientId."
    exit 1
}

# ─── Helper ──────────────────────────────────────────────────────────────────

function Write-Step {
    param([string]$Message)
    Write-Host "`n── $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Fail {
    param([string]$Message)
    Write-Error "✗ $Message"
}

# ─── Step 1: Validate prerequisites ──────────────────────────────────────────

Write-Step 'Step 1: Validating prerequisites'

$prereqs = @(
    @{ Cmd = 'az';   Args = '--version';         Min = '2.60'; Label = 'Azure CLI' },
    @{ Cmd = 'func'; Args = '--version';         Min = '4.0';  Label = 'Azure Functions Core Tools v4' },
    @{ Cmd = 'node'; Args = '--version';         Min = '22.0'; Label = 'Node.js' },
    @{ Cmd = 'npm';  Args = '--version';         Min = '9.0';  Label = 'npm' }
)

foreach ($p in $prereqs) {
    $raw = & $p.Cmd $p.Args 2>&1 | Select-Object -First 1
    if (-not $raw) {
        Write-Fail "$($p.Label) not found. Please install it and re-run."
        exit 1
    }
    Write-Success "$($p.Label) found: $raw"
}

# ─── Step 2: Validate Azure subscription ─────────────────────────────────────

Write-Step 'Step 2: Validating Azure subscription'

$account = az account show --output json 2>&1 | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) {
    Write-Fail 'Not logged in to Azure. Run: az login'
    exit 1
}

if ($account.id -ne $SubscriptionId) {
    Write-Fail "Wrong subscription. Expected: $SubscriptionId`nCurrent:  $($account.id)`nRun: az account set --subscription $SubscriptionId"
    exit 1
}

Write-Success "Subscription OK: $($account.name) ($($account.id))"

if (-not $SkipInfra) {
    # ─── Step 3: Create resource group (idempotent) ───────────────────────────

    Write-Step 'Step 3: Creating resource group (idempotent)'

    az group create `
        --name $ResourceGroup `
        --location $Location `
        --output none

    Write-Success "Resource group '$ResourceGroup' ready"

    # ─── Step 4: Deploy Bicep infrastructure ─────────────────────────────────

    Write-Step 'Step 4: Deploying Bicep infrastructure'

    $bicepTemplate = Join-Path $RepoRoot 'infra' 'main.bicep'

    $deployJson = az deployment group create `
        --resource-group $ResourceGroup `
        --template-file $bicepTemplate `
        --parameters env=dev `
        --parameters "location=$Location" `
        --parameters "swaLocation=$($Config.swaRegion)" `
        --parameters aiDailyEnrichmentLimit=10 `
        --parameters "entraTenantId=$($Config.tenantId)" `
        --parameters "entraClientId=$EntraClientId" `
        --parameters "googleClientId=$($DevEnv.googleClientId)" `
        --output json

    if ($LASTEXITCODE -ne 0) {
        Write-Fail 'Bicep deployment failed. Review the error above.'
        exit 1
    }

    $deployOutput = $deployJson | ConvertFrom-Json
    $swaHostname  = $deployOutput.properties.outputs.swaHostname.value
    Write-Success "Infrastructure deployed. SWA hostname: $swaHostname"
}

if (-not $SkipApp) {
    # ─── Step 5: Build frontend ───────────────────────────────────────────────

    Write-Step 'Step 5: Building frontend'

    Push-Location (Join-Path $RepoRoot 'frontend')
    try {
        # --legacy-peer-deps: vite-plugin-pwa hasn't yet published Vite 8 peer support
        cmd /c "rmdir /s /q node_modules" 2>$null
        npm install --prefer-offline --legacy-peer-deps
        if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
        npm run build -- --mode dev
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
    } finally {
        Pop-Location
    }

    Write-Success 'Frontend built'

    # ─── Step 6: Deploy frontend to SWA ──────────────────────────────────────
    # az staticwebapp does not have a 'deploy' subcommand; use the SWA CLI instead.

    Write-Step 'Step 6: Deploying frontend to SWA'

    $swaToken = az staticwebapp secrets list `
        --name $SwaName `
        --resource-group $ResourceGroup `
        --query 'properties.apiKey' `
        --output tsv

    $distPath = Join-Path $RepoRoot 'frontend' 'dist'
    npx --yes @azure/static-web-apps-cli deploy $distPath `
        --deployment-token $swaToken `
        --env default

    if ($LASTEXITCODE -ne 0) {
        Write-Fail 'SWA frontend deployment failed. Review the error above.'
        exit 1
    }

    Write-Success 'Frontend deployed'

    # ─── Step 7: Build API ────────────────────────────────────────────────────

    Write-Step 'Step 7: Building API'

    Push-Location (Join-Path $RepoRoot 'api')
    try {
        cmd /c "rmdir /s /q node_modules" 2>$null
        npm install --prefer-offline
        if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
        npm run build
        if ($LASTEXITCODE -ne 0) { throw 'API build failed' }
    } finally {
        Pop-Location
    }

    Write-Success 'API built'

    # ─── Step 8: Publish API to Function App ──────────────────────────────────

    Write-Step 'Step 8: Publishing API to Function App'

    Push-Location (Join-Path $RepoRoot 'api')
    try {
        func azure functionapp publish $FuncAppName --node
        if ($LASTEXITCODE -ne 0) { throw "func publish failed for $FuncAppName" }
    } finally {
        Pop-Location
    }

    Write-Success "API published to $FuncAppName"
}

# ─── Done ─────────────────────────────────────────────────────────────────────

Write-Host ''
Write-Host '════════════════════════════════════════' -ForegroundColor Green
Write-Host ' WordSprout DEV deployment complete! 🚀' -ForegroundColor Green
Write-Host '════════════════════════════════════════' -ForegroundColor Green

if (-not $SkipInfra -and $swaHostname) {
    Write-Host " DEV URL: https://$swaHostname" -ForegroundColor Yellow
} else {
    $hostname = az staticwebapp show `
        --name $SwaName `
        --resource-group $ResourceGroup `
        --query 'properties.defaultHostname' `
        --output tsv 2>$null
    if ($hostname) {
        Write-Host " DEV URL: https://$hostname" -ForegroundColor Yellow
    }
}
Write-Host ''
