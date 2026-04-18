#Requires -Version 7.0
<#
.SYNOPSIS
    Manage the WordSprout user allowlist in Azure Cosmos DB.

.DESCRIPTION
    Lists pending access requests and approves users by creating allowlist
    documents in Cosmos DB using the Cosmos DB data-plane REST API with AAD authentication.

    IMPORTANT — How approval works:
    Access request documents store userId = '_access_requests' (a Cosmos DB
    partition key grouping, NOT the user's identity sub claim). The allowlist
    check in authorise.ts requires an 'allowlist:<userId>' document.

    The userId format depends on the sign-in provider:
    - Microsoft: plain sub claim (e.g. 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')
    - Google:    prefixed with 'google:' (e.g. 'google:117234567890123456789')

    To approve a user:
    1. Run -List to find the user's sub claim and email.
       The sub is captured automatically when the user submits their access request
       while signed in. If sub is missing, ask the user to sign in and re-submit.
    2. Run -Approve -Email <email> -Sub <sub>.
       For Google users, pass the full 'google:...' value as -Sub.

.PARAMETER Environment
    Target environment: 'dev' or 'prod'. Required.

.PARAMETER List
    List all pending access requests.

.PARAMETER Approve
    Approve a user. Requires -Email and -Sub.

.PARAMETER Email
    Email address of the user to approve. Used with -Approve.

.PARAMETER Sub
    The user's sub claim (pairwise subject identifier from their JWT).
    Obtain this from the -List output — it is stored on the access request document.
    Used with -Approve.

.EXAMPLE
    # List pending access requests for DEV
    .\scripts\manage-allowlist.ps1 -Environment dev -List

.EXAMPLE
    # Approve a Microsoft user in PROD
    .\scripts\manage-allowlist.ps1 -Environment prod -Approve -Email 'user@example.com' -Sub 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

.EXAMPLE
    # Approve a Google user in PROD (note the google: prefix)
    .\scripts\manage-allowlist.ps1 -Environment prod -Approve -Email 'user@gmail.com' -Sub 'google:117234567890123456789'
#>
[CmdletBinding(DefaultParameterSetName = 'List')]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dev', 'prod')]
    [string] $Environment,

    [Parameter(Mandatory = $true, ParameterSetName = 'List')]
    [switch] $List,

    [Parameter(Mandatory = $true, ParameterSetName = 'Approve')]
    [switch] $Approve,

    [Parameter(Mandatory = $true, ParameterSetName = 'Approve')]
    [string] $Email,

    [Parameter(Mandatory = $true, ParameterSetName = 'Approve')]
    [string] $Sub
)

$ErrorActionPreference = 'Stop'

$ScriptRoot     = $PSScriptRoot
$RepoRoot       = Split-Path $ScriptRoot -Parent
$Config         = Get-Content (Join-Path $RepoRoot 'infra' 'config.json') -Raw | ConvertFrom-Json
$EnvConfig      = $Config.environments.$Environment

$SubscriptionId = $Config.subscriptionId
$AccountName    = $EnvConfig.cosmosAccount
$DatabaseName   = $Config.cosmos.database
$ContainerName  = $Config.cosmos.container

# ─── Validate Azure subscription ─────────────────────────────────────────────

$accountJson = az account show --output json 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error 'Not logged in to Azure. Run: az login'
    exit 1
}
$account = $accountJson | ConvertFrom-Json
if ($account.id -ne $SubscriptionId) {
    Write-Error "Wrong subscription. Expected: $SubscriptionId`nCurrent: $($account.id)`nRun: az account set --subscription $SubscriptionId"
    exit 1
}

Write-Host "Target: $AccountName ($Environment)" -ForegroundColor Cyan

# ─── Acquire Cosmos DB data-plane AAD token ───────────────────────────────────

$tokenJson = az account get-access-token --resource https://cosmos.azure.com --output json 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to acquire Cosmos DB access token. Ensure you are logged in: az login"
    exit 1
}
$CosmosToken    = ($tokenJson | ConvertFrom-Json).accessToken
$CosmosEndpoint = "https://$AccountName.documents.azure.com"
$CosmosBasePath = "dbs/$DatabaseName/colls/$ContainerName"

function Get-CosmosHeaders {
    param($PartitionKeyValue = $null, [string]$ApiVersion = '2018-12-31')
    $headers = @{
        'Authorization' = "type=aad&ver=1.0&sig=$CosmosToken"
        'x-ms-version'  = $ApiVersion
        'x-ms-date'     = (Get-Date).ToUniversalTime().ToString('R')
        'Cache-Control'  = 'no-cache'
    }
    if (-not [string]::IsNullOrEmpty($PartitionKeyValue)) {
        $headers['x-ms-documentdb-partitionkey'] = (ConvertTo-Json @($PartitionKeyValue) -Compress)
    }
    return $headers
}

function Invoke-CosmosQuery {
    param([string]$SqlQuery)
    $uri     = "$CosmosEndpoint/$CosmosBasePath/docs"
    $headers = Get-CosmosHeaders
    $headers['Content-Type']                                      = 'application/query+json'
    $headers['x-ms-documentdb-isquery']                          = 'true'
    $headers['x-ms-documentdb-query-enablecrosspartition']       = 'true'
    $body    = @{ query = $SqlQuery; parameters = @() } | ConvertTo-Json -Compress
    $response = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $body -ContentType 'application/query+json' -SkipHeaderValidation
    return $response.Documents
}

function Invoke-CosmosCreate {
    param([hashtable]$Document, [string]$PartitionKeyValue)
    $uri     = "$CosmosEndpoint/$CosmosBasePath/docs"
    $headers = Get-CosmosHeaders -PartitionKeyValue $PartitionKeyValue
    $body    = $Document | ConvertTo-Json -Compress
    Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $body -ContentType 'application/json' -SkipHeaderValidation | Out-Null
}

function Invoke-CosmosPatch {
    param([string]$DocId, [string]$PartitionKeyValue, [array]$Operations)
    $uri     = "$CosmosEndpoint/$CosmosBasePath/docs/$DocId"
    $headers = Get-CosmosHeaders -PartitionKeyValue $PartitionKeyValue -ApiVersion '2020-07-15'
    $body    = @{ operations = $Operations } | ConvertTo-Json -Depth 5 -Compress
    Invoke-RestMethod -Method Patch -Uri $uri -Headers $headers -Body $body -ContentType 'application/json' -SkipHeaderValidation | Out-Null
}

# ─── List pending access requests ────────────────────────────────────────────

if ($List) {
    Write-Host "`nFetching pending access requests..." -ForegroundColor Cyan

    $query = "SELECT c.id, c.email, c.sub, c.requestedAt, c.status FROM c WHERE c.type = 'access_request' AND c.status = 'pending'"
    $items = Invoke-CosmosQuery -SqlQuery $query

    if (-not $items -or $items.Count -eq 0) {
        Write-Host 'No pending access requests found.' -ForegroundColor Yellow
    } else {
        Write-Host "`nPending access requests ($($items.Count)):" -ForegroundColor Green
        $items | ForEach-Object {
            Write-Host "  Email:       $($_.email)"
            if ($_.sub) {
                Write-Host "  Sub:         $($_.sub)" -ForegroundColor Green
            } else {
                Write-Host "  Sub:         (not captured — user submitted request before signing in)" -ForegroundColor Yellow
            }
            Write-Host "  Requested:   $($_.requestedAt)"
            Write-Host "  Document ID: $($_.id)"
            Write-Host ''
        }
        Write-Host 'To approve: .\scripts\manage-allowlist.ps1 -Environment <env> -Approve -Email <email> -Sub <sub>' -ForegroundColor Cyan
        Write-Host 'Use the Sub value shown above. If sub is missing, the user must sign in first, then re-submit their request.' -ForegroundColor Yellow
    }
    exit 0
}

# ─── Approve a user ───────────────────────────────────────────────────────────

if ($Approve) {
    $Email = $Email.Trim().ToLower()
    $Sub   = $Sub.Trim()

    Write-Host "`nApproving user: $Email (sub: $Sub)" -ForegroundColor Cyan

    # 1. Find the pending access request by email
    $findQuery = "SELECT * FROM c WHERE c.type = 'access_request' AND c.email = '$Email' AND c.status = 'pending'"
    $requests  = Invoke-CosmosQuery -SqlQuery $findQuery

    if (-not $requests -or $requests.Count -eq 0) {
        Write-Error "No pending access request found for email: $Email"
        exit 1
    }

    $accessRequest = $requests[0]
    $requestDocId  = $accessRequest.id
    Write-Host "Found access request: $requestDocId" -ForegroundColor Green

    # 2. Create allowlist document
    $now         = (Get-Date -Format 'o')
    $allowlistId = "allowlist:$Sub"

    Invoke-CosmosCreate -PartitionKeyValue $Sub -Document @{
        id        = $allowlistId
        userId    = $Sub
        type      = 'allowlist'
        email     = $Email
        allowedAt = $now
        createdAt = $now
        updatedAt = $now
    }

    Write-Host "Allowlist document created: $allowlistId" -ForegroundColor Green

    # 3. Update the access request status to 'approved'
    try {
        Invoke-CosmosPatch -DocId $requestDocId -PartitionKeyValue '_access_requests' -Operations @(
            @{ op = 'set'; path = '/status';    value = 'approved' }
            @{ op = 'set'; path = '/updatedAt'; value = $now }
        )
        Write-Host "Access request status updated to 'approved'" -ForegroundColor Green
    } catch {
        Write-Warning "Allowlist document created but could not update access request status to 'approved'. Update manually if needed. Error: $_"
    }

    Write-Host ''
    Write-Host "✓ User $Email approved. They can now sign in to WordSprout ($Environment)." -ForegroundColor Green
    exit 0
}
