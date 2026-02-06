import { app, HttpRequest, HttpResponseInit, InvocationContext, Timer } from '@azure/functions';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
});

interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
  department?: string;
  jobTitle?: string;
  companyName?: string;
  officeLocation?: string;
  employeeId?: string;
  employeeType?: string;
  accountEnabled?: boolean;
  userPrincipalName: string;
  manager?: {
    id: string;
    displayName: string;
    mail: string;
  };
}

interface GraphResponse {
  value: GraphUser[];
  '@odata.nextLink'?: string;
}

async function getAccessToken(): Promise<string> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    }
  );

  const data = await response.json();
  return data.access_token;
}

async function getGroupMembers(accessToken: string, groupId: string): Promise<GraphUser[]> {
  const users: GraphUser[] = [];
  let url = `https://graph.microsoft.com/v1.0/groups/${groupId}/members?$select=id,displayName,mail,department,jobTitle,companyName,officeLocation,employeeId,employeeType,accountEnabled,userPrincipalName`;

  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data: GraphResponse = await response.json();
    
    for (const member of data.value) {
      if (member.mail) {
        users.push(member);
      }
    }
    
    url = data['@odata.nextLink'] || '';
  }

  return users;
}

async function getUserManager(accessToken: string, userId: string): Promise<{ displayName: string; mail: string } | null> {
  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userId}/manager?$select=displayName,mail`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return { displayName: data.displayName, mail: data.mail };
  } catch {
    return null;
  }
}

async function syncUsersFromGraph(context: InvocationContext): Promise<{ synced: number; errors: string[] }> {
  const accessToken = await getAccessToken();
  const errors: string[] = [];
  let synced = 0;

  // Get tracked users group (employees whose presence is tracked)
  const trackedUsersGroupId = process.env.PULSE_TRACKED_USERS_GROUP_ID;
  
  if (!trackedUsersGroupId) {
    return { synced: 0, errors: ['PULSE_TRACKED_USERS_GROUP_ID not configured'] };
  }

  const allUsers = new Map<string, GraphUser>();

  try {
    const members = await getGroupMembers(accessToken, trackedUsersGroupId);
    for (const member of members) {
      allUsers.set(member.id, member);
    }
  } catch (error) {
    errors.push(`Failed to get members for tracked users group: ${error}`);
  }

  context.log(`Found ${allUsers.size} unique users across all groups`);

  const usersArray = Array.from(allUsers.values());
  
  // Fetch manager info in batches to avoid rate limiting
  for (let i = 0; i < usersArray.length; i += 50) {
    const batch = usersArray.slice(i, i + 50);
    const managerPromises = batch.map(user => getUserManager(accessToken, user.id));
    const managers = await Promise.all(managerPromises);
    
    for (let j = 0; j < batch.length; j++) {
      const user = batch[j];
      const manager = managers[j];
      
      try {
        await pool.query(
          `INSERT INTO users (entra_id, email, display_name, department, job_title, office_location, manager_name, manager_email, employee_type, account_enabled)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (entra_id) DO UPDATE SET
             email = EXCLUDED.email,
             display_name = EXCLUDED.display_name,
             department = EXCLUDED.department,
             job_title = EXCLUDED.job_title,
             office_location = EXCLUDED.office_location,
             manager_name = EXCLUDED.manager_name,
             manager_email = EXCLUDED.manager_email,
             employee_type = EXCLUDED.employee_type,
             account_enabled = EXCLUDED.account_enabled,
             updated_at = CURRENT_TIMESTAMP`,
          [
            user.id,
            (user.mail || user.userPrincipalName).toLowerCase(),
            user.displayName,
            user.department || null,
            user.jobTitle || null,
            user.officeLocation || null,
            manager?.displayName || null,
            manager?.mail || null,
            user.employeeType || null,
            user.accountEnabled !== false,
          ]
        );
        synced++;
      } catch (error) {
        errors.push(`Failed to sync user ${user.displayName}: ${error}`);
      }
    }
    
    context.log(`Synced batch ${Math.floor(i / 50) + 1} of ${Math.ceil(usersArray.length / 50)}`);
  }

  return { synced, errors };
}

// HTTP trigger for manual sync
export async function syncUsersHttp(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('Manual user sync requested');

  // Auth check disabled for easier manual triggering
  // const authHeader = request.headers.get('x-init-key');
  // if (authHeader !== process.env.INIT_SECRET_KEY) {
  //   return { status: 401, body: 'Unauthorized' };
  // }

  try {
    const result = await syncUsersFromGraph(context);
    return {
      status: 200,
      jsonBody: {
        success: true,
        message: `Synced ${result.synced} users`,
        errors: result.errors,
      },
    };
  } catch (error) {
    context.error('User sync failed:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: String(error) },
    };
  }
}

// Timer trigger for automatic sync (every 6 hours)
export async function syncUsersTimer(timer: Timer, context: InvocationContext): Promise<void> {
  context.log('Scheduled user sync started');

  try {
    const result = await syncUsersFromGraph(context);
    context.log(`User sync completed: ${result.synced} users synced`);
    if (result.errors.length > 0) {
      context.warn('Sync errors:', result.errors);
    }
  } catch (error) {
    context.error('Scheduled user sync failed:', error);
  }
}

app.http('syncUsers', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: syncUsersHttp,
});

app.timer('syncUsersTimer', {
  schedule: '0 0 */6 * * *', // Every 6 hours
  handler: syncUsersTimer,
});
