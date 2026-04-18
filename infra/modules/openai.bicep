// infra/modules/openai.bicep
// Azure OpenAI account with a gpt-4o-mini GlobalStandard deployment.

@description('Environment name (dev or prod).')
param env string

@description('Azure region for all resources.')
param location string

@description('Tokens-per-minute capacity for the model deployment (thousands). Use 1 for dev, 10 for prod.')
param aiModelCapacity int = 10

var accountName = 'oai-wordsprout-${env}'

resource openAiAccount 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: accountName
  location: location
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: accountName
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: true
  }
  tags: {
    Environment: env
    Project: 'wordsprout'
  }
}

resource gpt4oMiniDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: openAiAccount
  name: 'gpt-4o-mini'
  sku: {
    name: 'GlobalStandard'
    capacity: aiModelCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o-mini'
      version: '2024-07-18'
    }
  }
}

output openaiEndpoint string = openAiAccount.properties.endpoint
