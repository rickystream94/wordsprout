// infra/modules/cosmos-rbac.bicep
// Grants Cosmos DB Built-in Data Contributor (data-plane) to the Function App's
// managed identity. Called as a module from main.bicep.

@description('Environment name: dev or prod.')
param env string

@description('Principal ID of the Function App system-assigned managed identity.')
param funcAppPrincipalId string

var cosmosAccountName = 'cosmosdb-wordsprout-${env}'

resource cosmosAccountRef 'Microsoft.DocumentDB/databaseAccounts@2024-02-15-preview' existing = {
  name: cosmosAccountName
}

// Built-in role 00000000-0000-0000-0000-000000000002 = Cosmos DB Built-in Data Contributor
// (full read/write on data plane, no account management).
resource cosmosSqlRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-02-15-preview' = {
  name: guid(cosmosAccountRef.id, 'func-wordsprout-${env}', '00000000-0000-0000-0000-000000000002')
  parent: cosmosAccountRef
  properties: {
    roleDefinitionId: '${cosmosAccountRef.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    principalId: funcAppPrincipalId
    scope: cosmosAccountRef.id
  }
}
