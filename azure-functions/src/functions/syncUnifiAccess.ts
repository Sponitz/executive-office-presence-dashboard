import { app, InvocationContext, Timer } from '@azure/functions';
import {
  checkEventExists,
  closeSession,
  createSession,
  getOfficeByUnifiSiteId,
  getOpenSession,
  getUserByEmail,
  insertAccessEvent,
  updateSyncStatus,
  getLastSyncTimestamp,
} from '../services/database.js';
import { fetchAccessEvents, fetchDoors, mapEventType } from '../services/unifiAccess.js';

async function syncUnifiAccess(myTimer: Timer, context: InvocationContext): Promise<void> {
  context.log('UniFi Access sync started');

  try {
    const lastSync = await getLastSyncTimestamp('unifi_access');
    const doors = await fetchDoors();
    const doorToLocationMap = new Map(doors.map((d) => [d.id, d.location]));

    const events = await fetchAccessEvents(lastSync || undefined);
    context.log(`Fetched ${events.length} events from UniFi Access`);

    let processedCount = 0;
    let lastEventTimestamp: Date | null = null;

    for (const event of events) {
      const exists = await checkEventExists(event.id, 'unifi_access');
      if (exists) continue;

      const eventType = mapEventType(event.event_type);
      if (!eventType) continue;

      const locationId = doorToLocationMap.get(event.door_id);
      if (!locationId) continue;

      const office = await getOfficeByUnifiSiteId(locationId);
      if (!office) continue;

      const userEmail = event.user_email;
      if (!userEmail) continue;

      const user = await getUserByEmail(userEmail);
      if (!user) continue;

      const timestamp = new Date(event.timestamp);

      await insertAccessEvent({
        user_id: user.id,
        office_id: office.id,
        event_type: eventType,
        source: 'unifi_access',
        device_info: event.door_id,
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
    }

    await updateSyncStatus('unifi_access', 'success', lastEventTimestamp || undefined);
    context.log(`UniFi Access sync completed. Processed ${processedCount} events.`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.error(`UniFi Access sync failed: ${errorMessage}`);
    await updateSyncStatus('unifi_access', 'error', undefined, errorMessage);
    throw error;
  }
}

app.timer('syncUnifiAccess', {
  schedule: '0 */5 * * * *',
  handler: syncUnifiAccess,
});
