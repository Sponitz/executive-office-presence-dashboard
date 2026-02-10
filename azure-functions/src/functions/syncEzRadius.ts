import { app, HttpRequest, HttpResponseInit, InvocationContext, Timer } from '@azure/functions';
import {
  checkEventExists,
  createSession,
  getUserByEmail,
  insertAccessEvent,
  updateSyncStatus,
  getLastSyncTimestamp,
  getOffices,
} from '../services/database.js';
import { fetchEzRadiusAuthLogs, getOfficeSearchTermsForIp, IP_OFFICE_MAP } from '../services/ezRadius.js';
import type { Office } from '../types/index.js';

async function syncEzRadiusCore(
  context: InvocationContext,
  since?: Date,
): Promise<{ processed: number; skipped: number; matched: number; errors: string[] }> {
  context.log('EZRadius sync started');

  const errors: string[] = [];
  let processedCount = 0;
  let skippedCount = 0;
  let matchedCount = 0;

  try {
    const offices = await getOffices();
    context.log(`Loaded ${offices.length} offices`);

    const ipToOffice = new Map<string, Office>();
    for (const mapping of IP_OFFICE_MAP) {
      const office = offices.find(o =>
        mapping.officeSearchTerms.some(term => o.name.toLowerCase().includes(term))
      );
      if (office) {
        ipToOffice.set(mapping.ip, office);
        context.log(`Mapped IP ${mapping.ip} (${mapping.description}) -> ${office.name}`);
      } else {
        context.log(`No matching office for IP ${mapping.ip} (${mapping.description})`);
      }
    }

    const sinceDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    context.log(`Fetching EZRadius auth logs since ${sinceDate.toISOString()}`);

    const authEvents = await fetchEzRadiusAuthLogs(sinceDate);
    context.log(`Fetched ${authEvents.length} auth events from EZRadius`);

    let lastEventTimestamp: Date | null = null;

    for (const event of authEvents) {
      try {
        const rawEventId = `ezradius_${event.UserName}_${event.DateCreated}_${event.RequestingIP}`;

        const exists = await checkEventExists(rawEventId, 'ezradius');
        if (exists) {
          skippedCount++;
          continue;
        }

        if (!event.Successful) {
          skippedCount++;
          continue;
        }

        const office = ipToOffice.get(event.RequestingIP);
        if (!office) {
          skippedCount++;
          continue;
        }

        const user = await getUserByEmail(event.UserName);

        if (!user) {
          skippedCount++;
          continue;
        }

        matchedCount++;
        const timestamp = new Date(event.DateCreated);

        await insertAccessEvent({
          user_id: user.id,
          office_id: office.id,
          event_type: 'entry',
          source: 'ezradius',
          device_info: `${event.AccessPolicyName || 'WiFi'} (${event.AuthenticationType || 'unknown'})`,
          raw_event_id: rawEventId,
          timestamp,
        });

        await createSession(user.id, office.id, timestamp);

        processedCount++;
        if (!lastEventTimestamp || timestamp > lastEventTimestamp) {
          lastEventTimestamp = timestamp;
        }
      } catch (eventError) {
        const msg = eventError instanceof Error ? eventError.message : 'Unknown error';
        errors.push(`Event for ${event.UserName}: ${msg}`);
      }
    }

    if (lastEventTimestamp) {
      await updateSyncStatus('ezradius', 'success', lastEventTimestamp);
    } else {
      await updateSyncStatus('ezradius', 'success');
    }
    context.log(`EZRadius sync completed. Processed: ${processedCount}, Matched: ${matchedCount}, Skipped: ${skippedCount}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.error(`EZRadius sync failed: ${errorMessage}`);
    await updateSyncStatus('ezradius', 'error', undefined, errorMessage);
    errors.push(errorMessage);
  }

  return { processed: processedCount, skipped: skippedCount, matched: matchedCount, errors };
}

async function syncEzRadius(myTimer: Timer, context: InvocationContext): Promise<void> {
  const lastSync = await getLastSyncTimestamp('ezradius');
  await syncEzRadiusCore(context, lastSync || undefined);
}

async function triggerEzRadiusSync(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const daysParam = request.query.get('days');
  const days = daysParam ? parseInt(daysParam, 10) : 30;

  const since = new Date();
  since.setDate(since.getDate() - days);

  context.log(`Manual EZRadius sync triggered for last ${days} days (since ${since.toISOString()})`);

  const result = await syncEzRadiusCore(context, since);

  return {
    status: 200,
    jsonBody: {
      message: `EZRadius sync completed for last ${days} days`,
      processed: result.processed,
      skipped: result.skipped,
      matched: result.matched,
      errors: result.errors.slice(0, 10),
      totalErrors: result.errors.length,
    }
  };
}

app.timer('syncEzRadius', {
  schedule: '0 */5 * * * *',
  handler: syncEzRadius,
});

app.http('triggerEzRadiusSync', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: triggerEzRadiusSync,
});
