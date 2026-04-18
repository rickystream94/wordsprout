// infra/modules/storage.bicep
// Storage account required by the Flex Consumption Function App (AzureWebJobsStorage).

@description('Environment name (dev or prod).')
param env string

@description('Azure region for all resources.')
param location string

// Storage account names must be 3–24 chars, lowercase, alphanumeric only (no hyphens).
// Pattern: 'stwordsprout2' + env suffix (dev/prod) — new names to avoid collision with
// previously provisioned accounts in the old resource groups.
var storageAccountName = 'stwordsprout2${env}'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
  tags: {
    Environment: env
    Project: 'wordsprout'
  }
}

// Flex Consumption requires this container to exist before the first func publish.
// The Function App's functionAppConfig.deployment.storage.value points here.
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  name: 'default'
  parent: storageAccount
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: 'deployments'
  parent: blobService
  properties: {
    publicAccess: 'None'
  }
}

var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

output storageConnectionString string = storageConnectionString
output storageAccountName string = storageAccount.name
output storageBlobEndpoint string = storageAccount.properties.primaryEndpoints.blob
