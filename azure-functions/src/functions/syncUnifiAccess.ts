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
import { fetchAccessEvents, fetchDoors, fetchUsers, mapEventType, getControllers, fetchAccessEventsFromController } from '../services/unifiAccess.js';

interface ControllerOfficeMapping {
  controllerName: string;
  officeSearchTerms: string[];
}

const CONTROLLER_OFFICE_MAP: ControllerOfficeMapping[] = [
  { controllerName: 'primary', officeSearchTerms: ['minneapolis', 'minnesota'] },
  { controllerName: 'minneapolis', officeSearchTerms: ['minneapolis', 'minnesota'] },
  { controllerName: 'dallas', officeSearchTerms: ['dallas'] },
];

async function syncUnifiAccessCore(context: InvocationContext, since?: Date, limit?: number): Promise<{ processed: number; skipped: number; matched: number; errors: string[] }> {
  context.log('UniFi Access sync started');
  
  const errors: string[] = [];
  let processedCount = 0;
  let skippedCount = 0;
  let matchedCount = 0;

  try {
    const offices = await getOffices();
    const controllers = getControllers();
    
    if (controllers.length === 0) {
      errors.push('No UniFi controllers configured');
      return { processed: 0, skipped: 0, matched: 0, errors };
    }

    for (const controller of controllers) {
      try {
        const mapping = CONTROLLER_OFFICE_MAP.find(m => m.controllerName === controller.name);
        const searchTerms = mapping?.officeSearchTerms || [controller.name];
        const office = offices.find(o => 
          searchTerms.some(term => o.name.toLowerCase().includes(term))
        );
        
        if (!office) {
          context.log(`No matching office found for controller ${controller.name}, skipping`);
          continue;
        }
        
        context.log(`Syncing ${controller.name} -> ${office.name} (${office.id})`);

        context.log(`Fetching UniFi users from ${controller.name} for email mapping...`);
        let userIdToEmail = new Map<string, string>();
        try {
          const unifiUsersResponse = await fetch(`${controller.url}/api/v1/developer/users`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${controller.token}`, 'Content-Type': 'application/json' },
            // @ts-expect-error - Node.js SSL bypass
            agent: new (await import('https')).Agent({ rejectUnauthorized: false }),
          });
          if (unifiUsersResponse.ok) {
            const usersResult = await unifiUsersResponse.json() as { data: Array<{ id: string; full_name: string; user_email?: string }> };
            for (const u of usersResult.data || []) {
              if (u.user_email) {
                userIdToEmail.set(u.id, u.user_email);
              }
            }
          }
        } catch (e) {
          context.log(`Could not fetch users from ${controller.name}: ${e}`);
        }
        context.log(`Built email mapping for ${userIdToEmail.size} users from ${controller.name}`);

        const events = await fetchAccessEventsFromController(controller, since, limit || 1000, 50);
        context.log(`Fetched ${events.length} events from ${controller.name}`);

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

            const userEmail = userIdToEmail.get(event.user_id);
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
              office_id: office.id,
              event_type: eventType,
              source: 'unifi_access',
              device_info: event.door_name || event.door_id,
              raw_event_id: event.id,
              timestamp,
            });

            if (eventType === 'entry') {
              const existingSession = await getOpenSession(user.id, office.id);
              if (!existingSession) {
                await createSession(user.id, office.id, timestamp);
              }
            } else if (eventType === 'exit') {
              const openSession = await getOpenSession(user.id, office.id);
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

        if (lastEventTimestamp) {
          await updateSyncStatus(`unifi_access_${controller.name}`, 'success', lastEventTimestamp);
        }
        context.log(`${controller.name} sync done. Processed: ${processedCount}, Skipped: ${skippedCount}`);
      } catch (controllerError) {
        const msg = controllerError instanceof Error ? controllerError.message : 'Unknown error';
        context.error(`Controller ${controller.name} sync failed: ${msg}`);
        errors.push(`${controller.name}: ${msg}`);
      }
    }

    await updateSyncStatus('unifi_access', 'success');
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
