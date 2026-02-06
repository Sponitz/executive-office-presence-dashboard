import type { EzradiusAuthEvent } from '../types/index.js';

const EZRADIUS_API_URL = process.env.EZRADIUS_API_URL || '';
const EZRADIUS_API_KEY = process.env.EZRADIUS_API_KEY || '';

interface EzradiusApiResponse {
  success: boolean;
  data: EzradiusAuthEvent[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
  };
}

export async function fetchAuthEvents(since?: Date, limit: number = 100): Promise<EzradiusAuthEvent[]> {
  const url = new URL(`${EZRADIUS_API_URL}/v1/auth/events`);
  
  if (since) {
    url.searchParams.set('since', since.toISOString());
  }
  url.searchParams.set('limit', limit.toString());
  url.searchParams.set('event_type', 'Access-Accept');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-API-Key': EZRADIUS_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`EZRADIUS API error: ${response.status} ${response.statusText}`);
  }

  const data: EzradiusApiResponse = await response.json();
  return data.data;
}

export async function fetchLocations(): Promise<Array<{ id: string; name: string; nas_ip: string }>> {
  const response = await fetch(`${EZRADIUS_API_URL}/v1/locations`, {
    method: 'GET',
    headers: {
      'X-API-Key': EZRADIUS_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`EZRADIUS API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

export function extractEmailFromUsername(username: string): string | null {
  if (username.includes('@')) {
    return username.toLowerCase();
  }
  
  const emailMatch = username.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    return emailMatch[1].toLowerCase();
  }
  
  return null;
}
