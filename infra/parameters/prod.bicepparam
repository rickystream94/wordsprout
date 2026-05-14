// infra/parameters/prod.bicepparam
// Reference values for the PROD environment (documentation only — not used directly
// by deploy commands; all parameters are passed inline by cd-prod.yml / runbook from config.json).

using '../main.bicep'

param env = 'prod'
param location = 'northeurope'
param swaLocation = 'westeurope'
param aiDailyEnrichmentLimit = 20
param sessionSecret = 'REPLACE_AT_DEPLOY_TIME'
param entraTenantId = 'REPLACE_AT_DEPLOY_TIME'
param entraClientId = 'REPLACE_AT_DEPLOY_TIME'
param googleClientId = 'REPLACE_AT_DEPLOY_TIME'
