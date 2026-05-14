// infra/parameters/dev.bicepparam
// Reference values for the DEV environment (documentation only — not used directly
// by deploy commands; all parameters are passed inline by deploy-dev.ps1 from config.json).

using '../main.bicep'

param env = 'dev'
param location = 'northeurope'
param swaLocation = 'westeurope'
param aiDailyEnrichmentLimit = 10
param sessionSecret = 'REPLACE_AT_DEPLOY_TIME'
param entraTenantId = 'REPLACE_AT_DEPLOY_TIME'
param entraClientId = 'REPLACE_AT_DEPLOY_TIME'
param googleClientId = 'REPLACE_AT_DEPLOY_TIME'
