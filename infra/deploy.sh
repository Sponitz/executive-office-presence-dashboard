#!/bin/bash
set -e

RESOURCE_GROUP="pulse-rg"
LOCATION="centralus"
POSTGRES_PASSWORD=""
EZRADIUS_API_KEY=""
UNIFI_ACCESS_TOKEN=""
UNIFI_ACCESS_URL=""

print_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -g, --resource-group    Resource group name (default: improving-pulse-rg)"
    echo "  -l, --location          Azure region (default: centralus)"
    echo "  -p, --postgres-password PostgreSQL admin password (required)"
    echo "  -e, --ezradius-key      EZRADIUS API key"
    echo "  -u, --unifi-token       UniFi Access API token"
    echo "  -c, --unifi-url         UniFi Access controller URL"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Example:"
    echo "  $0 -p 'MySecurePassword123!' -e 'ezradius-api-key' -u 'unifi-token' -c 'https://unifi.example.com:12445'"
}

while [[ $# -gt 0 ]]; do
    case $1 in
        -g|--resource-group)
            RESOURCE_GROUP="$2"
            shift 2
            ;;
        -l|--location)
            LOCATION="$2"
            shift 2
            ;;
        -p|--postgres-password)
            POSTGRES_PASSWORD="$2"
            shift 2
            ;;
        -e|--ezradius-key)
            EZRADIUS_API_KEY="$2"
            shift 2
            ;;
        -u|--unifi-token)
            UNIFI_ACCESS_TOKEN="$2"
            shift 2
            ;;
        -c|--unifi-url)
            UNIFI_ACCESS_URL="$2"
            shift 2
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "Error: PostgreSQL password is required"
    print_usage
    exit 1
fi

echo "Creating resource group: $RESOURCE_GROUP in $LOCATION..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

echo "Deploying Azure resources..."
az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file main.bicep \
    --parameters \
        postgresAdminPassword="$POSTGRES_PASSWORD" \
        ezradiusApiKey="$EZRADIUS_API_KEY" \
        unifiAccessToken="$UNIFI_ACCESS_TOKEN" \
        unifiAccessUrl="$UNIFI_ACCESS_URL" \
        azureAdClientId="ac274c9a-9a88-470f-8518-23f740bb0e26" \
        azureAdTenantId="f2267c2e-5a54-49f4-84fa-e4f2f4038a2e"

echo ""
echo "Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Get the web app URL from the deployment outputs"
echo "2. Configure custom domain 'pulse.improving.com' in Azure Portal"
echo "3. Run the database schema: psql -h <postgres-host> -U pulseadmin -d office_presence -f database/schema.sql"
echo "4. Deploy the frontend: cd .. && npm run build && az webapp deployment source config-zip -g $RESOURCE_GROUP -n improving-pulse-web --src dist.zip"
echo "5. Deploy Azure Functions: cd azure-functions && npm run build && func azure functionapp publish improving-pulse-functions"
