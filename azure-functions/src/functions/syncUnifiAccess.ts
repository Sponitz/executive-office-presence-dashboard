import { app, HttpRequest, HttpResponseInit, InvocationContext, Timer } from '@azure/functions';
import {
  checkEventExists,
  closeSession,
  createSession,
  getOfficeByUnifiSiteId,
  getOpenSession,
  getUserByEmail,
  getUserByDisplayName,
  insertAccessEvent,
  updateSyncStatus,
  getLastSyncTimestamp,
  getOffices,
} from '../services/database.js';
import { fetchAccessEvents, fetchDoors, fetchUsers, mapEventType } from '../services/unifiAccess.js';

async function syncUnifiAccessCore(context: InvocationContext, since?: Date, limit?: number): Promise<{ processed: number; skipped: number; matched: number; errors: string[] }> {
  context.log('UniFi Access sync started');
  
  const errors: string[] = [];
  let processedCount = 0;
  let skippedCount = 0;
  let matchedCount = 0;

  try {
    // Get all offices to find Minneapolis
    const offices = await getOffices();
    const minneapolisOffice = offices.find(o => o.name.toLowerCase().includes('minneapolis') || o.name.toLowerCase().includes('minnesota'));
    
    if (!minneapolisOffice) {
      errors.push('Minneapolis office not found in database');
      return { processed: 0, skipped: 0, matched: 0, errors };
    }
    
    context.log(`Found Minneapolis office: ${minneapolisOffice.name} (${minneapolisOffice.id})`);

    // Fetch UniFi users to build ID-to-email mapping
    context.log('Fetching UniFi users for email mapping...');
    const unifiUsers = await fetchUsers();
    const userIdToEmail = new Map<string, string>();
    for (const u of unifiUsers) {
      if (u.email) {
        userIdToEmail.set(u.id, u.email);
      }
    }
    context.log(`Built email mapping for ${userIdToEmail.size} UniFi users`);

    const events = await fetchAccessEvents(since, limit || 1000, 50);
    context.log(`Fetched ${events.length} events from UniFi Access`);

    let lastEventTimestamp: Date | null = null;

    for (const event of events) {
      try {
        const exists = await checkEventExists(event.id, 'unifi_access');
        if (exists) {
          skippedCount++;
          continue;
        }

        const eventType = mapEventType(event.event_type);
        if (!eventType) {
          skippedCount++;
          continue;
        }

        // Get email from UniFi user mapping using the actor ID
        const userEmail = userIdToEmail.get(event.user_id);
        
        // Try to find user by email first (from UniFi user mapping), then by display name
        let user = userEmail ? await getUserByEmail(userEmail) : null;
        if (!user && event.user_name) {
          user = await getUserByDisplayName(event.user_name);
        }
        
        if (!user) {
          skippedCount++;
          continue;
        }
        
        matchedCount++;

        const timestamp = new Date(event.timestamp);

        await insertAccessEvent({
          user_id: user.id,
          office_id: minneapolisOffice.id,
          event_type: eventType,
          source: 'unifi_access',
          device_info: event.door_name || event.door_id,
          raw_event_id: event.id,
          timestamp,
        });

        if (eventType === 'entry') {
          const existingSession = await getOpenSession(user.id, minneapolisOffice.id);
          if (!existingSession) {
            await createSession(user.id, minneapolisOffice.id, timestamp);
          }
        } else if (eventType === 'exit') {
          const openSession = await getOpenSession(user.id, minneapolisOffice.id);
          if (openSession) {
            await closeSession(openSession.id, timestamp);
          }
        }

        processedCount++;
        if (!lastEventTimestamp || timestamp > lastEventTimestamp) {
          lastEventTimestamp = timestamp;
        }
      } catch (eventError) {
        const msg = eventError instanceof Error ? eventError.message : 'Unknown error';
        errors.push(`Event ${event.id}: ${msg}`);
      }
    }

    await updateSyncStatus('unifi_access', 'success', lastEventTimestamp || undefined);
    context.log(`UniFi Access sync completed. Processed ${processedCount} events, skipped ${skippedCount}.`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.error(`UniFi Access sync failed: ${errorMessage}`);
    await updateSyncStatus('unifi_access', 'error', undefined, errorMessage);
    errors.push(errorMessage);
  }
  
  return { processed: processedCount, skipped: skippedCount, matched: matchedCount, errors };
}

async function syncUnifiAccess(myTimer: Timer, context: InvocationContext): Promise<void> {
  const lastSync = await getLastSyncTimestamp('unifi_access');
  await syncUnifiAccessCore(context, lastSync || undefined);
}

// Manual trigger endpoint for initial sync
async function triggerUnifiSync(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const authHeader = request.headers.get('x-init-key');
  if (authHeader !== process.env.INIT_SECRET_KEY) {
    return { status: 401, body: 'Unauthorized' };
  }

  // Get days parameter from query string (default 30 days)
  const daysParam = request.query.get('days');
  const days = daysParam ? parseInt(daysParam, 10) : 30;
  
  // Calculate since date
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  context.log(`Manual UniFi sync triggered for last ${days} days (since ${since.toISOString()})`);
  
  const result = await syncUnifiAccessCore(context, since, 2000);
  
  return {
    status: 200,
    jsonBody: {
      message: `Sync completed for last ${days} days`,
      processed: result.processed,
      skipped: result.skipped,
      matched: result.matched,
      errors: result.errors.slice(0, 10), // Only return first 10 errors
      totalErrors: result.errors.length,
    }
  };
}

app.timer('syncUnifiAccess', {
  schedule: '0 */5 * * * *',
  handler: syncUnifiAccess,
});

app.http('triggerUnifiSync', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: triggerUnifiSync,
});
