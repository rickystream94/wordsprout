// infra/main.bicep
// Single-resource-group deployment for WordSprout (northeurope).
// All resources (Storage, Cosmos DB, Function App, SWA, RBAC) deploy to the same RG.
// Deploy with: scripts/deploy-dev.ps1 (DEV) or .github/workflows/cd-prod.yml (PROD).

@description('Environment name: dev or prod.')
@allowed(['dev', 'prod'])
param env string

@description('Azure region for all resources. Defaults to the resource group location.')
param location string = resourceGroup().location

@description('Microsoft Entra ID tenant ID.')
param entraTenantId string

@description('Microsoft Entra ID application client ID for this environment.')
param entraClientId string

@description('Google OAuth 2.0 client ID for this environment.')
param googleClientId string

@description('Maximum AI enrichment requests per user per day.')
param aiDailyEnrichmentLimit int = 20

@description('Azure region for the Static Web App. SWA is only available in a limited set of regions. Sourced from infra/config.json swaRegion.')
param swaLocation string = 'westeurope'

// TEMPORARILY DISABLED (unused while OpenAI module is commented out — restore when re-enabling AI):
// @description('GPT-4o-mini deployment capacity in thousands of tokens per minute.')
// param aiModelCapacity int = 10
// @description('Azure region for the OpenAI account. Defaults to swedencentral.')
// param openAiLocation string = 'swedencentral'

// ─── 1. Storage ───────────────────────────────────────────────────────────────

module storage 'modules/storage.bicep' = {
  name: 'storage-${env}'
  params: {
    env: env
    location: location
  }
}

// ─── 2. Cosmos DB ─────────────────────────────────────────────────────────────

module cosmos 'modules/cosmos.bicep' = {
  name: 'cosmos-${env}'
  params: {
    env: env
    location: location
  }
}

// ─── 3. Azure OpenAI ──────────────────────────────────────────────────────────
// TEMPORARILY DISABLED: Azure OpenAI quota not yet approved for swedencentral.
// To re-enable: uncomment the module below, uncomment the RBAC section (§5),
// restore openaiEndpoint in the funcapp params, and restore the openaiEndpoint output.
// module openai 'modules/openai.bicep' = {
//   name: 'openai-${env}'
//   params: {
//     env: env
//     location: openAiLocation
//     aiModelCapacity: aiModelCapacity
//   }
// }

// ─── 4. Function App ──────────────────────────────────────────────────────────

module funcapp 'modules/funcapp.bicep' = {
  name: 'funcapp-${env}'
  params: {
    env: env
    location: location
    storageConnectionString: storage.outputs.storageConnectionString
    storageDeploymentContainerUrl: '${storage.outputs.storageBlobEndpoint}deployments'
    cosmosEndpoint: cosmos.outputs.cosmosEndpoint
    // openaiEndpoint: openai.outputs.openaiEndpoint  // TODO: restore when OpenAI module is re-enabled
    entraTenantId: entraTenantId
    entraClientId: entraClientId
    googleClientId: googleClientId
    aiDailyEnrichmentLimit: aiDailyEnrichmentLimit
  }
}

// ─── 5. RBAC: Function App MI → Cosmos DB (data plane) ───────────────────────
// cosmos-rbac.bicep is a module so it can be reused without cross-RG scope issues.

module cosmosRbac 'modules/cosmos-rbac.bicep' = {
  name: 'cosmos-rbac-${env}'
  params: {
    env: env
    funcAppPrincipalId: funcapp.outputs.funcAppPrincipalId
  }
}

// ─── 6. RBAC: Function App MI → Azure OpenAI ─────────────────────────────────
// TEMPORARILY DISABLED: uncomment when OpenAI module (§3) is re-enabled.
// var openAiAccountName = 'oai-wordsprout-${env}'
// var cognitiveServicesOpenAiUserRoleId = '5e0bd9bd-7b93-4f28-af87-19fc36ad1654'
// resource openAiAccountRef 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' existing = {
//   name: openAiAccountName
// }
// resource openAiRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
//   name: guid(openAiAccountRef.id, 'func-wordsprout-${env}', cognitiveServicesOpenAiUserRoleId)
//   scope: openAiAccountRef
//   properties: {
//     roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesOpenAiUserRoleId)
//     principalId: funcapp.outputs.funcAppPrincipalId
//     principalType: 'ServicePrincipal'
//   }
// }

// ─── 7. Static Web App + BYOF backend link ───────────────────────────────────

module swa 'modules/swa.bicep' = {
  name: 'swa-${env}'
  params: {
    env: env
    location: location
    swaLocation: swaLocation
    funcAppId: funcapp.outputs.funcAppId
    // Standard tier is required for BYOF linked backends — Free tier does not support linkedBackends.
    swaTier: env == 'prod' ? 'Standard' : 'Standard' // Both tiers use Standard: BYOF linkedBackends require Standard (Free doesn't support them)
  }
}

// ─── Outputs ─────────────────────────────────────────────────────────────────

output swaHostname string = swa.outputs.swaDefaultHostname
output swaName string = swa.outputs.swaName
output funcAppName string = funcapp.outputs.funcAppName
// output openaiEndpoint string = openai.outputs.openaiEndpoint  // TODO: restore when OpenAI module is re-enabled