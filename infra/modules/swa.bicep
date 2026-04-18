// infra/modules/swa.bicep
// Azure Static Web App with BYOF backend link to the standalone Function App.
// Note: Microsoft.Web/staticSites is only available in a small set of regions
// (westus2, centralus, eastus2, westeurope, eastasia). SWA is CDN-backed so the
// chosen region is just a metadata/billing anchor and has no latency impact.

@description('Environment name (dev or prod).')
param env string

@description('Azure region for all resources.')
param location string

@description('Region for the SWA resource. Must be one of the regions that support Microsoft.Web/staticSites (westus2, centralus, eastus2, westeurope, eastasia). Sourced from infra/config.json swaRegion.')
param swaLocation string

@description('Resource ID of the Function App to link as the BYOF backend.')
param funcAppId string

@description('SWA tier: Free for dev, Standard for prod.')
param swaTier string = 'Free'

var swaName = 'swa-wordsprout-${env}'

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: swaName
  location: swaLocation
  sku: {
    name: swaTier
    tier: swaTier
  }
  properties: {
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
  tags: {
    Environment: env
    Project: 'wordsprout'
  }
}

resource swaBackendLink 'Microsoft.Web/staticSites/linkedBackends@2023-12-01' = {
  parent: staticWebApp
  name: 'backend'
  properties: {
    backendResourceId: funcAppId
    region: location
  }
}

output swaName string = staticWebApp.name
output swaDefaultHostname string = staticWebApp.properties.defaultHostname
