import type { UnifiAccessEvent } from '../types/index.js';
import https from 'https';

// Create an HTTPS agent that ignores SSL certificate errors (UniFi uses self-signed certs)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

// Support multiple UniFi Access controllers
// Minneapolis: access.msp.improving.com:12445
export interface UnifiController {
  name: string;
  url: string;
  token: string;
}

function getControllers(): UnifiController[] {
  const controllers: UnifiController[] = [];
  
  // Primary controller (legacy env vars)
  if (process.env.UNIFI_ACCESS_URL && process.env.UNIFI_ACCESS_TOKEN) {
    controllers.push({
      name: 'primary',
      url: process.env.UNIFI_ACCESS_URL,
      token: process.env.UNIFI_ACCESS_TOKEN,
    });
  }
  
  // Minneapolis controller
  if (process.env.UNIFI_MSP_URL && process.env.UNIFI_MSP_TOKEN) {
    controllers.push({
      name: 'minneapolis',
      url: process.env.UNIFI_MSP_URL,
      token: process.env.UNIFI_MSP_TOKEN,
    });
  }
  
  return controllers;
}

// Legacy single controller support - prefer MSP (Minneapolis) since it's the one that's port-forwarded
const UNIFI_ACCESS_URL = process.env.UNIFI_MSP_URL || process.env.UNIFI_ACCESS_URL || '';
const UNIFI_ACCESS_TOKEN = process.env.UNIFI_MSP_TOKEN || process.env.UNIFI_ACCESS_TOKEN || '';

interface UnifiApiResponse<T> {
  code: string;
  msg: string;
  data: T;
}

interface UnifiAccessLogEntry {
  _id: string;
  door_id: string;
  door_name?: string;
  actor_id: string;
  actor_type: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  user_email?: string;
  event_type: string;
  event_time: number;
  result: string;
}

interface FetchLogsRequest {
  topic: string;
  since?: number;
  until?: number;
}

interface SystemLogHit {
  '@timestamp': string;
  _id: string;
  _source: {
    actor: {
      id: string;
      display_name: string;
      type: string;
    };
    event: {
      type: string;
      result: string;
      published: number;
      log_key: string;
    };
    target: Array<{
      id: string;
      display_name: string;
      type: string;
    }>;
  };
}

interface SystemLogsResponse {
  hits: SystemLogHit[];
  total: number;
}

export async function fetchAccessEvents(since?: Date, limit: number = 1000, maxPages: number = 50): Promise<UnifiAccessEvent[]> {
  const allEvents: UnifiAccessEvent[] = [];
  const pageSize = 25; // UniFi API works best with smaller page sizes
  let page = 1;
  let hasMore = true;
  
  const requestBody: FetchLogsRequest = {
    topic: 'door_openings',
  };

  while (hasMore && page <= maxPages && allEvents.length < limit) {
    const response = await fetch(`${UNIFI_ACCESS_URL}/api/v1/developer/system/logs?page_num=${page}&page_size=${pageSize}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${UNIFI_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      // @ts-expect-error - Node.js specific option for SSL bypass
      agent: httpsAgent,
    });

    if (!response.ok) {
      throw new Error(`UniFi Access API error: ${response.status} ${response.statusText}`);
    }

    const result: UnifiApiResponse<SystemLogsResponse> = await response.json();
    
    if (result.code !== 'SUCCESS') {
      throw new Error(`UniFi Access API error: ${result.msg}`);
    }

    const hits = result.data.hits;
    if (hits.length === 0) {
      hasMore = false;
      break;
    }

    for (const hit of hits) {
      const eventTimestamp = new Date(hit['@timestamp']);
      
      // If we have a since date, skip events older than it
      if (since && eventTimestamp < since) {
        hasMore = false;
        break;
      }
      
      const doorTarget = hit._source.target.find(t => t.type === 'door');
      allEvents.push({
        id: hit._id,
        door_id: doorTarget?.id || '',
        door_name: doorTarget?.display_name,
        user_id: hit._source.actor.id,
        user_name: hit._source.actor.display_name,
        user_email: undefined,
        event_type: hit._source.event.type,
        timestamp: hit['@timestamp'],
        result: hit._source.event.result,
      });
    }

    page++;
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return allEvents;
}

export async function fetchDoors(): Promise<Array<{ id: string; name: string; location?: string }>> {
  const response = await fetch(`${UNIFI_ACCESS_URL}/api/v1/developer/doors`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${UNIFI_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    // @ts-expect-error - Node.js specific option for SSL bypass
    agent: httpsAgent,
  });

  if (!response.ok) {
    throw new Error(`UniFi Access API error: ${response.status} ${response.statusText}`);
  }

  const result: UnifiApiResponse<Array<{ unique_id: string; name: string; location_id?: string }>> = await response.json();
  
  if (result.code !== 'SUCCESS') {
    throw new Error(`UniFi Access API error: ${result.msg}`);
  }

  return result.data.map(door => ({
    id: door.unique_id,
    name: door.name,
    location: door.location_id,
  }));
}

export async function fetchUsers(): Promise<Array<{ id: string; name: string; email?: string }>> {
  const response = await fetch(`${UNIFI_ACCESS_URL}/api/v1/developer/users`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${UNIFI_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    // @ts-expect-error - Node.js specific option for SSL bypass
    agent: httpsAgent,
  });

  if (!response.ok) {
    throw new Error(`UniFi Access API error: ${response.status} ${response.statusText}`);
  }

  const result: UnifiApiResponse<Array<{ id: string; full_name: string; user_email?: string }>> = await response.json();
  
  if (result.code !== 'SUCCESS') {
    throw new Error(`UniFi Access API error: ${result.msg}`);
  }

  return result.data.map(user => ({
    id: user.id,
    name: user.full_name,
    email: user.user_email,
  }));
}

export function mapEventType(unifiEventType: string): 'entry' | 'exit' | null {
  const entryTypes = ['access.door.unlock', 'access.door.open', 'access.granted'];
  const exitTypes = ['access.door.exit', 'access.exit.granted'];

  if (entryTypes.includes(unifiEventType)) return 'entry';
  if (exitTypes.includes(unifiEventType)) return 'exit';
  return null;
}

// Fetch events from a specific controller with pagination
export async function fetchAccessEventsFromController(
  controller: UnifiController,
  since?: Date,
  limit: number = 1000,
  maxPages: number = 50
): Promise<UnifiAccessEvent[]> {
  const allEvents: UnifiAccessEvent[] = [];
  const pageSize = 25;
  let page = 1;
  let hasMore = true;
  
  const requestBody: FetchLogsRequest = {
    topic: 'door_openings',
  };

  while (hasMore && page <= maxPages && allEvents.length < limit) {
    const response = await fetch(`${controller.url}/api/v1/developer/system/logs?page_num=${page}&page_size=${pageSize}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${controller.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      // @ts-expect-error - Node.js specific option for SSL bypass
      agent: httpsAgent,
    });

    if (!response.ok) {
      throw new Error(`UniFi Access API error (${controller.name}): ${response.status} ${response.statusText}`);
    }

    const result: UnifiApiResponse<SystemLogsResponse> = await response.json();
    
    if (result.code !== 'SUCCESS') {
      throw new Error(`UniFi Access API error (${controller.name}): ${result.msg}`);
    }

    const hits = result.data.hits;
    if (hits.length === 0) {
      hasMore = false;
      break;
    }

    for (const hit of hits) {
      const eventTimestamp = new Date(hit['@timestamp']);
      
      // If we have a since date, skip events older than it
      if (since && eventTimestamp < since) {
        hasMore = false;
        break;
      }
      
      const doorTarget = hit._source.target.find(t => t.type === 'door');
      allEvents.push({
        id: `${controller.name}_${hit._id}`,
        door_id: doorTarget?.id || '',
        door_name: doorTarget?.display_name,
        user_id: hit._source.actor.id,
        user_name: hit._source.actor.display_name,
        user_email: undefined,
        event_type: hit._source.event.type,
        timestamp: hit['@timestamp'],
        result: hit._source.event.result,
        controller: controller.name,
      });
    }

    page++;
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return allEvents;
}

// Fetch doors from a specific controller
export async function fetchDoorsFromController(
  controller: UnifiController
): Promise<Array<{ id: string; name: string; location?: string; controller: string }>> {
  const response = await fetch(`${controller.url}/api/v1/developer/doors`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${controller.token}`,
      'Content-Type': 'application/json',
    },
    // @ts-expect-error - Node.js specific option for SSL bypass
    agent: httpsAgent,
  });

  if (!response.ok) {
    throw new Error(`UniFi Access API error (${controller.name}): ${response.status} ${response.statusText}`);
  }

  const result: UnifiApiResponse<Array<{ unique_id: string; name: string; location_id?: string }>> = await response.json();
  
  if (result.code !== 'SUCCESS') {
    throw new Error(`UniFi Access API error (${controller.name}): ${result.msg}`);
  }

  return result.data.map(door => ({
    id: `${controller.name}_${door.unique_id}`,
    name: door.name,
    location: door.location_id,
    controller: controller.name,
  }));
}

// Fetch events from all configured controllers
export async function fetchAccessEventsFromAllControllers(
  since?: Date,
  limit: number = 100
): Promise<UnifiAccessEvent[]> {
  const controllers = getControllers();
  
  if (controllers.length === 0) {
    return [];
  }
  
  const results = await Promise.allSettled(
    controllers.map(controller => fetchAccessEventsFromController(controller, since, limit))
  );
  
  const allEvents: UnifiAccessEvent[] = [];
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allEvents.push(...result.value);
    }
  }
  
  return allEvents;
}

// Export getControllers for use in sync function
export { getControllers };
