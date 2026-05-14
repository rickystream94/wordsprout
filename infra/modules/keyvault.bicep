// Key Vault for storing application secrets (e.g. SESSION_SECRET).
// Uses RBAC authorization — no legacy access policies.

@description('Environment name (dev or prod).')
param env string

@description('Azure region for all resources.')
param location string

@description('The session signing secret value to store.')
@secure()
param sessionSecret string

var vaultName = 'kv-wordsprout-${env}'

resource keyVault 'Microsoft.KeyVault/vaults@2025-05-01' = {
  name: vaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: tenant().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
  }
  tags: {
    Environment: env
    Project: 'wordsprout'
  }
}

resource sessionSecretResource 'Microsoft.KeyVault/vaults/secrets@2025-05-01' = {
  parent: keyVault
  name: 'SESSION-SECRET'
  properties: {
    value: sessionSecret
  }
}

output keyVaultUri string = keyVault.properties.vaultUri
output sessionSecretUri string = sessionSecretResource.properties.secretUri
