@description('The name of the application')
param appName string = 'improving-pulse'

@description('The location for all resources')
param location string = resourceGroup().location

@description('The SKU for the App Service Plan')
param appServicePlanSku string = 'B1'

@description('The SKU for PostgreSQL')
param postgresSkuName string = 'Standard_B1ms'

@description('PostgreSQL administrator login')
param postgresAdminLogin string = 'pulseadmin'

@description('PostgreSQL administrator password')
@secure()
param postgresAdminPassword string

@description('EZRADIUS API Key')
@secure()
param ezradiusApiKey string = ''

@description('UniFi Access API Token')
@secure()
param unifiAccessToken string = ''

@description('UniFi Access Controller URL')
param unifiAccessUrl string = ''

@description('Azure AD Client ID')
param azureAdClientId string = ''

@description('Azure AD Tenant ID')
param azureAdTenantId string = ''

var appServicePlanName = '${appName}-plan'
var webAppName = '${appName}-web'
var functionAppName = '${appName}-functions'
var storageAccountName = replace('${appName}storage', '-', '')
var postgresServerName = '${appName}-postgres'
var postgresDatabaseName = 'office_presence'

resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: appServicePlanSku
    tier: 'Basic'
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: webAppName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appSettings: [
        {
          name: 'VITE_AZURE_CLIENT_ID'
          value: azureAdClientId
        }
        {
          name: 'VITE_AZURE_TENANT_ID'
          value: azureAdTenantId
        }
        {
          name: 'VITE_API_BASE_URL'
          value: 'https://${functionAppName}.azurewebsites.net/api'
        }
        {
          name: 'VITE_DEMO_MODE'
          value: 'false'
        }
      ]
    }
    httpsOnly: true
  }
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'DATABASE_URL'
          value: 'postgresql://${postgresAdminLogin}:${postgresAdminPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/${postgresDatabaseName}?sslmode=require'
        }
        {
          name: 'EZRADIUS_API_URL'
          value: 'https://usa.ezradius.io'
        }
        {
          name: 'EZRADIUS_API_KEY'
          value: ezradiusApiKey
        }
        {
          name: 'UNIFI_ACCESS_URL'
          value: unifiAccessUrl
        }
        {
          name: 'UNIFI_ACCESS_TOKEN'
          value: unifiAccessToken
        }
      ]
    }
    httpsOnly: true
  }
}

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' = {
  name: postgresServerName
  location: location
  sku: {
    name: postgresSkuName
    tier: 'Burstable'
  }
  properties: {
    version: '15'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2022-12-01' = {
  parent: postgresServer
  name: postgresDatabaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource postgresFirewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2022-12-01' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output postgresHost string = postgresServer.properties.fullyQualifiedDomainName
