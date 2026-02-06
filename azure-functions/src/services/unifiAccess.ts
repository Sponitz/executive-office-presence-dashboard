import type { UnifiAccessEvent } from '../types/index.js';

const UNIFI_ACCESS_URL = process.env.UNIFI_ACCESS_URL || '';
const UNIFI_ACCESS_TOKEN = process.env.UNIFI_ACCESS_TOKEN || '';

interface UnifiApiResponse {
  data: UnifiAccessEvent[];
  meta: {
    total: number;
    offset: number;
    limit: number;
  };
}

export async function fetchAccessEvents(since?: Date, limit: number = 100): Promise<UnifiAccessEvent[]> {
  const url = new URL(`${UNIFI_ACCESS_URL}/api/v1/developer/door_events`);
  
  if (since) {
    url.searchParams.set('since', Math.floor(since.getTime() / 1000).toString());
  }
  url.searchParams.set('limit', limit.toString());

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${UNIFI_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`UniFi Access API error: ${response.status} ${response.statusText}`);
  }

  const data: UnifiApiResponse = await response.json();
  return data.data;
}

export async function fetchDoors(): Promise<Array<{ id: string; name: string; site_id: string }>> {
  const response = await fetch(`${UNIFI_ACCESS_URL}/api/v1/developer/doors`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${UNIFI_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`UniFi Access API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

export function mapEventType(unifiEventType: string): 'entry' | 'exit' | null {
  const entryTypes = ['access.door.unlock', 'access.door.open', 'access.granted'];
  const exitTypes = ['access.door.exit', 'access.exit.granted'];

  if (entryTypes.includes(unifiEventType)) return 'entry';
  if (exitTypes.includes(unifiEventType)) return 'exit';
  return null;
}
