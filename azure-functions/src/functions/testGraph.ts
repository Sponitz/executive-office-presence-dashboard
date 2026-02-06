import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export async function testGraph(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('Testing Graph API access');

  const authHeader = request.headers.get('x-init-key');
  if (authHeader !== process.env.INIT_SECRET_KEY) {
    return { status: 401, body: 'Unauthorized' };
  }

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  context.log(`Tenant: ${tenantId}, Client: ${clientId}, Secret length: ${clientSecret?.length || 0}`);

  if (!tenantId || !clientId || !clientSecret) {
    return {
      status: 400,
      jsonBody: { 
        error: 'Missing credentials',
        tenantId: !!tenantId,
        clientId: !!clientId,
        clientSecret: !!clientSecret
      }
    };
  }

  try {
    // Get access token
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      }
    );

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      return {
        status: 400,
        jsonBody: { error: 'Failed to get token', details: tokenData }
      };
    }

    // Test getting group members - use tracked users group
    const groupId = process.env.PULSE_TRACKED_USERS_GROUP_ID || process.env.PULSE_EXECUTIVES_GROUP_ID;
    const graphResponse = await fetch(
      `https://graph.microsoft.com/v1.0/groups/${groupId}/members?$select=id,displayName,mail,department,jobTitle`,
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );

    const graphData = await graphResponse.json();

    return {
      status: 200,
      jsonBody: {
        tokenSuccess: true,
        groupId,
        graphStatus: graphResponse.status,
        graphData
      }
    };
  } catch (error) {
    return {
      status: 500,
      jsonBody: { error: String(error) }
    };
  }
}

app.http('testGraph', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: testGraph,
});
