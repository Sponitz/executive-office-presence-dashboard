import type { UnifiAccessEvent } from '../types/index.js';

const UNIFI_ACCESS_URL = process.env.UNIFI_ACCESS_URL || '';
const UNIFI_ACCESS_TOKEN = process.env.UNIFI_ACCESS_TOKEN || '';

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
  start_time?: number;
  end_time?: number;
  page_num?: number;
  page_size?: number;
}

export async function fetchAccessEvents(since?: Date, limit: number = 100): Promise<UnifiAccessEvent[]> {
  const now = Math.floor(Date.now() / 1000);
  const startTime = since ? Math.floor(since.getTime() / 1000) : now - 300;
  
  const requestBody: FetchLogsRequest = {
    start_time: startTime,
    end_time: now,
    page_num: 1,
    page_size: limit,
  };

  const response = await fetch(`${UNIFI_ACCESS_URL}/api/v1/developer/access_logs/fetch`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${UNIFI_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`UniFi Access API error: ${response.status} ${response.statusText}`);
  }

  const result: UnifiApiResponse<UnifiAccessLogEntry[]> = await response.json();
  
  if (result.code !== 'SUCCESS') {
    throw new Error(`UniFi Access API error: ${result.msg}`);
  }

  return result.data.map(entry => ({
    id: entry._id,
    door_id: entry.door_id,
    door_name: entry.door_name,
    user_id: entry.actor_id,
    user_name: entry.full_name || `${entry.first_name || ''} ${entry.last_name || ''}`.trim(),
    user_email: entry.user_email,
    event_type: entry.event_type,
    timestamp: new Date(entry.event_time * 1000).toISOString(),
    result: entry.result,
  }));
}

export async function fetchDoors(): Promise<Array<{ id: string; name: string; location?: string }>> {
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
