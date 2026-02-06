import { app, InvocationContext, Timer } from '@azure/functions';
import {
  checkEventExists,
  createSession,
  getOfficeByEzradiusLocationId,
  getOpenSession,
  getUserByEmail,
  insertAccessEvent,
  updateSyncStatus,
  getLastSyncTimestamp,
} from '../services/database.js';
import { fetchAuthEvents, extractEmailFromUsername } from '../services/ezradius.js';

async function syncEzradius(myTimer: Timer, context: InvocationContext): Promise<void> {
  context.log('EZRADIUS sync started');

  try {
    const lastSync = await getLastSyncTimestamp('ezradius');
    const events = await fetchAuthEvents(lastSync || undefined);
    context.log(`Fetched ${events.length} events from EZRADIUS`);

    let processedCount = 0;
    let lastEventTimestamp: Date | null = null;

    for (const event of events) {
      const exists = await checkEventExists(event.id, 'ezradius');
      if (exists) continue;

      const email = extractEmailFromUsername(event.username);
      if (!email) continue;

      const user = await getUserByEmail(email);
      if (!user) continue;

      const office = event.location_id
        ? await getOfficeByEzradiusLocationId(event.location_id)
        : null;
      if (!office) continue;

      const timestamp = new Date(event.timestamp);

      await insertAccessEvent({
        user_id: user.id,
        office_id: office.id,
        event_type: 'entry',
        source: 'ezradius',
        device_info: event.mac_address,
        raw_event_id: event.id,
        timestamp,
      });

      const existingSession = await getOpenSession(user.id, office.id);
      if (!existingSession) {
        await createSession(user.id, office.id, timestamp);
      }

      processedCount++;
      if (!lastEventTimestamp || timestamp > lastEventTimestamp) {
        lastEventTimestamp = timestamp;
      }
    }

    await updateSyncStatus('ezradius', 'success', lastEventTimestamp || undefined);
    context.log(`EZRADIUS sync completed. Processed ${processedCount} events.`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.error(`EZRADIUS sync failed: ${errorMessage}`);
    await updateSyncStatus('ezradius', 'error', undefined, errorMessage);
    throw error;
  }
}

app.timer('syncEzradius', {
  schedule: '0 */5 * * * *',
  handler: syncEzradius,
});
