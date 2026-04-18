#Requires -Version 7.0
<#
.SYNOPSIS
    Creates the Azure AD app registration used by GitHub Actions for OIDC
    (Workload Identity Federation). Assigns Contributor on wordsprout-prod
    and saves the client ID to infra/config.json.

.DESCRIPTION
    Automates runbook §2 — replaces the manual portal and CLI steps for setting
    up OIDC authentication from GitHub Actions to Azure.

    You must be logged in to Azure CLI targeting the correct tenant:
        az login
    then set the subscription:
        az account set --subscription 86264ae5-dd19-43d5-a842-4163c5c245c4

.PARAMETER GitHubOrg
    Your GitHub username or organisation name. Used to scope the federated
    credential to your repository.

.PARAMETER GitHubRepo
    GitHub repository name. Defaults to the value in infra/config.json (wordsprout).

.EXAMPLE
    .\scripts\setup-oidc.ps1 -GitHubOrg 'myusername'

.EXAMPLE
    .\scripts\setup-oidc.ps1 -GitHubOrg 'myorg' -GitHubRepo 'my-fork'
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $GitHubOrg,

    [Parameter(Mandatory = $false)]
    [string] $GitHubRepo
)

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

$ScriptRoot = $PSScriptRoot
$RepoRoot   = Split-Path $ScriptRoot -Parent
$ConfigPath = Join-Path $RepoRoot 'infra' 'config.json'
$Config     = Get-Content $ConfigPath -Raw | ConvertFrom-Json

$TenantId       = $Config.tenantId
$SubscriptionId = $Config.subscriptionId
$ProdRG         = $Config.environments.prod.resourceGroup
$Region         = $Config.region

if (-not $GitHubRepo) { $GitHubRepo = $Config.github.repo }
if (-not $GitHubRepo) {
    Write-Error "GitHubRepo is required. Pass -GitHubRepo or set github.repo in infra/config.json."
    exit 1
}

# ─── Helpers ─────────────────────────────────────────────────────────────────

function Write-Step    { param([string]$m) Write-Host "`n── $m" -ForegroundColor Cyan }
function Write-Success { param([string]$m) Write-Host "✓ $m" -ForegroundColor Green }

# ─── Verify tenant + subscription ────────────────────────────────────────────

Write-Step 'Verifying Azure tenant and subscription'

$account = az account show --output json 2>&1 | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) {
    Write-Error "Not logged in. Run: az login"
    exit 1
}
if ($account.tenantId -ne $TenantId) {
    Write-Error "Wrong tenant.`n  Expected: $TenantId`n  Current:  $($account.tenantId)"
    exit 1
}
if ($account.id -ne $SubscriptionId) {
    Write-Host "  Switching to subscription $SubscriptionId..." -ForegroundColor Yellow
    az account set --subscription $SubscriptionId | Out-Null
}
Write-Success "Tenant: $TenantId  |  Subscription: $SubscriptionId"

# ─── Ensure PROD resource groups exist ──────────────────────────────────────

foreach ($pair in @(
    [pscustomobject]@{ Name = $ProdRG; Location = $Region }
)) {
    Write-Step "Ensuring PROD resource group '$($pair.Name)' exists"
    $rgExists = az group show --name $pair.Name --output json 2>&1
    if ($LASTEXITCODE -ne 0) {
        az group create --name $pair.Name --location $pair.Location --output none
        Write-Success "Resource group '$($pair.Name)' created (region: $($pair.Location))"
    } else {
        Write-Host "  Resource group '$($pair.Name)' already exists" -ForegroundColor Yellow
    }
}

# ─── Create app registration ──────────────────────────────────────────────────

Write-Step "Creating app registration 'wordsprout-github-actions'"

$appName = 'wordsprout-github-actions'
$existingApps = az ad app list --display-name $appName --output json | ConvertFrom-Json

if ($existingApps.Count -gt 0) {
    $app = $existingApps[0]
    Write-Host "  App '$appName' already exists — client ID: $($app.appId)" -ForegroundColor Yellow
} else {
    $app = az ad app create --display-name $appName --output json | ConvertFrom-Json
    Write-Success "App registration created: $($app.appId)"
}

# ─── Create service principal (required for role assignment) ──────────────────

Write-Step 'Creating service principal'

$spCheck = az ad sp show --id $app.appId --output json 2>&1
if ($LASTEXITCODE -ne 0) {
    az ad sp create --id $app.appId --output none
    Write-Success 'Service principal created'
} else {
    Write-Host '  Service principal already exists' -ForegroundColor Yellow
}

# ─── Create federated credential ─────────────────────────────────────────────

Write-Step "Adding federated credential for $GitHubOrg/$GitHubRepo (branch: master)"

$credName  = 'github-actions-master'
$fedCreds  = az rest --method GET `
    --uri "https://graph.microsoft.com/v1.0/applications/$($app.id)/federatedIdentityCredentials" `
    --output json | ConvertFrom-Json
$existing  = $fedCreds.value | Where-Object { $_.name -eq $credName }

if ($existing) {
    Write-Host "  Federated credential '$credName' already exists" -ForegroundColor Yellow
} else {
    $credBody = @{
        name      = $credName
        issuer    = 'https://token.actions.githubusercontent.com'
        subject   = "repo:$GitHubOrg/$($GitHubRepo):ref:refs/heads/master"
        audiences = @('api://AzureADTokenExchange')
    } | ConvertTo-Json -Compress

    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        $credBody | Set-Content $tmp -Encoding utf8
        az rest --method POST `
            --uri "https://graph.microsoft.com/v1.0/applications/$($app.id)/federatedIdentityCredentials" `
            --headers 'Content-Type=application/json' `
            --body "@$tmp" | Out-Null
    } finally {
        Remove-Item $tmp -ErrorAction SilentlyContinue
    }
    Write-Success "Federated credential created  (subject: repo:$GitHubOrg/$($GitHubRepo):ref:refs/heads/master)"
}

# ─── Assign Contributor role on PROD resource groups ─────────────────────────
# GitHub Actions deploys Bicep (storage + cosmos + funcapp + swa + RBAC) all to the
# single PROD resource group — Contributor on that one RG is sufficient.

Write-Step "Assigning Contributor role on $ProdRG"

$scope         = "/subscriptions/$SubscriptionId/resourceGroups/$ProdRG"
$existingRoles = az role assignment list `
    --assignee $app.appId `
    --role 'Contributor' `
    --scope $scope `
    --output json | ConvertFrom-Json

if ($existingRoles.Count -gt 0) {
    Write-Host "  Contributor role already assigned on $ProdRG" -ForegroundColor Yellow
} else {
    az role assignment create `
        --assignee $app.appId `
        --role 'Contributor' `
        --scope $scope `
        --output none
    Write-Success "Contributor role assigned on $ProdRG"
}

# ─── Update infra/config.json ─────────────────────────────────────────────────

Write-Step 'Updating infra/config.json'

$Config.oidcClientId  = $app.appId
$Config.github.org    = $GitHubOrg
$Config.github.repo   = $GitHubRepo
$Config | ConvertTo-Json -Depth 10 | Set-Content $ConfigPath -Encoding utf8

Write-Success 'config.json updated (oidcClientId, github.org, github.repo)'

# ─── Summary ─────────────────────────────────────────────────────────────────

Write-Host ''
Write-Host '════════════════════════════════════════════' -ForegroundColor Green
Write-Host ' OIDC setup complete!' -ForegroundColor Green
Write-Host '════════════════════════════════════════════' -ForegroundColor Green
Write-Host ''
Write-Host 'Set these as GitHub Actions Variables (not Secrets):' -ForegroundColor Cyan
Write-Host "  AZURE_CLIENT_ID       = $($app.appId)" -ForegroundColor Yellow
Write-Host "  AZURE_TENANT_ID       = $TenantId" -ForegroundColor Yellow
Write-Host "  AZURE_SUBSCRIPTION_ID = $SubscriptionId" -ForegroundColor Yellow
Write-Host ''
Write-Host 'Repository → Settings → Secrets and variables → Actions → Variables tab' -ForegroundColor Cyan
Write-Host ''
