// infra/parameters/dev.bicepparam
// Reference values for the DEV environment (documentation only — not used directly
// by deploy commands; all parameters are passed inline by deploy-dev.ps1 from config.json).

using '../main.bicep'

param env = 'dev'
param location = 'northeurope'
param swaLocation = 'westeurope'
param aiDailyEnrichmentLimit = 10

// entraTenantId — required, passed at deploy time from config.json (.tenantId)
// entraClientId — required, passed at deploy time from config.json (.environments.dev.entraClientId)
