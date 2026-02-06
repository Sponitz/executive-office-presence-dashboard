import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export async function testUnifi(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('Testing UniFi Access API');

  const authHeader = request.headers.get('x-init-key');
  if (authHeader !== process.env.INIT_SECRET_KEY) {
    return { status: 401, body: 'Unauthorized' };
  }

  const url = process.env.UNIFI_ACCESS_URL;
  const token = process.env.UNIFI_ACCESS_TOKEN;

  context.log(`URL: ${url}, Token length: ${token?.length || 0}`);

  if (!url || !token) {
    return {
      status: 400,
      jsonBody: { error: 'Missing credentials', url: !!url, token: !!token }
    };
  }

  const results: Record<string, unknown> = {};

  // Test 1: Try to get system info
  try {
    const sysResponse = await fetch(`${url}/api/v1/developer/system/info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    results.systemInfo = {
      status: sysResponse.status,
      data: await sysResponse.json().catch(() => sysResponse.text())
    };
  } catch (e) {
    results.systemInfo = { error: String(e) };
  }

  // Test 2: Try to get doors
  try {
    const doorsResponse = await fetch(`${url}/api/v1/developer/doors`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    results.doors = {
      status: doorsResponse.status,
      data: await doorsResponse.json().catch(() => doorsResponse.text())
    };
  } catch (e) {
    results.doors = { error: String(e) };
  }

  // Test 3: Try to get access logs
  try {
    const now = Math.floor(Date.now() / 1000);
    const logsResponse = await fetch(`${url}/api/v1/developer/access_logs/fetch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start_time: now - 86400, // Last 24 hours
        end_time: now,
        page_num: 1,
        page_size: 10,
      }),
    });
    results.accessLogs = {
      status: logsResponse.status,
      data: await logsResponse.json().catch(() => logsResponse.text())
    };
  } catch (e) {
    results.accessLogs = { error: String(e) };
  }

  return {
    status: 200,
    jsonBody: results
  };
}

app.http('testUnifi', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: testUnifi,
});
