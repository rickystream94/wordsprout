// infra/modules/funcapp.bicep
// Flex Consumption (FC1) App Service Plan + Function App (Node 20, v4 runtime).
// Flex Consumption is the recommended serverless hosting plan for Azure Functions.
// Requires northeurope (or another supported region) — FC1 is not available in denmarkeast.
// System-assigned managed identity enabled; authenticates to Cosmos DB and
// Azure OpenAI via Managed Identity (RBAC) — no secrets or Key Vault references.

@description('Environment name (dev or prod).')
param env string

@description('Azure region for all resources.')
param location string

@description('Storage account connection string for AzureWebJobsStorage.')
@secure()
param storageConnectionString string

@description('Blob container URL for Flex Consumption deployment packages (e.g. https://<account>.blob.core.windows.net/deployments).')
param storageDeploymentContainerUrl string

@description('Cosmos DB endpoint URI (public, non-secret).')
param cosmosEndpoint string

@description('Azure OpenAI endpoint URI (public, non-secret). Empty string while AI enrichment is temporarily disabled.')
param openaiEndpoint string = ''

@description('Microsoft Entra ID tenant ID.')
param entraTenantId string

@description('Microsoft Entra ID application client ID for this environment.')
param entraClientId string

@description('Google OAuth 2.0 client ID for this environment.')
param googleClientId string

@description('Maximum AI enrichment quota per user per day.')
param aiDailyEnrichmentLimit int = 20

var planName = 'plan-wordsprout-${env}'
var funcAppName = 'func-wordsprout-${env}'

resource flexPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  // No 'kind' on the plan — FC1 is Linux-only; kind is set on the sites resource instead.
  sku: {
    tier: 'FlexConsumption'
    name: 'FC1'
  }
  properties: {
    // Flex Consumption only supports Linux; reserved: true is required.
    reserved: true
  }
  tags: {
    Environment: env
    Project: 'wordsprout'
  }
}

resource funcApp 'Microsoft.Web/sites@2023-12-01' = {
  name: funcAppName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: flexPlan.id
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: storageConnectionString
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        // FUNCTIONS_WORKER_RUNTIME and WEBSITE_NODE_DEFAULT_VERSION are deprecated
        // in Flex Consumption — runtime is configured via functionAppConfig.runtime instead.
        {
          name: 'APP_ENV'
          value: env
        }
        {
          name: 'COSMOS_ENDPOINT'
          value: cosmosEndpoint
        }
        {
          name: 'COSMOS_DATABASE'
          value: 'wordsprout'
        }
        {
          name: 'COSMOS_CONTAINER'
          value: 'data'
        }
        {
          name: 'ENTRA_TENANT_ID'
          value: entraTenantId
        }
        {
          name: 'ENTRA_CLIENT_ID'
          value: entraClientId
        }
        {
          name: 'GOOGLE_CLIENT_ID'
          value: googleClientId
        }
        {
          name: 'AZURE_AI_ENDPOINT'
          value: openaiEndpoint
        }
        {
          name: 'AZURE_AI_DEPLOYMENT'
          value: 'gpt-4o-mini'
        }
        {
          name: 'AI_DAILY_ENRICHMENT_LIMIT'
          value: string(aiDailyEnrichmentLimit)
        }
      ]
      // linuxFxVersion is deprecated in Flex Consumption — runtime version is set in functionAppConfig.
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
    }
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: storageDeploymentContainerUrl
          authentication: {
            type: 'StorageAccountConnectionString'
            storageAccountConnectionStringName: 'AzureWebJobsStorage'
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 100
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'node'
        version: '24'
      }
    }
    httpsOnly: true
  }
  tags: {
    Environment: env
    Project: 'wordsprout'
  }
}

output funcAppId string = funcApp.id
output funcAppPrincipalId string = funcApp.identity.principalId
output funcAppName string = funcApp.name
