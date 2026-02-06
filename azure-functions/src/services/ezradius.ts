import type { EzradiusAuthEvent } from '../types/index.js';

const EZRADIUS_API_URL = process.env.EZRADIUS_API_URL || 'https://usa.ezradius.io';
const EZRADIUS_API_KEY = process.env.EZRADIUS_API_KEY || '';

interface AuditRequestModel {
  DateFrom: string;
  DateTo: string;
  MaxNumberOfRecords: number;
  PageNumber: number;
}

interface EzradiusAuthLogEntry {
  id?: string;
  timestamp: string;
  username: string;
  nasIpAddress?: string;
  nasIdentifier?: string;
  callingStationId?: string;
  calledStationId?: string;
  authResult: string;
  replyMessage?: string;
  policyName?: string;
  location?: string;
}

export async function fetchAuthEvents(since?: Date, limit: number = 100): Promise<EzradiusAuthEvent[]> {
  const now = new Date();
  const dateFrom = since || new Date(now.getTime() - 5 * 60 * 1000);
  
  const requestBody: AuditRequestModel = {
    DateFrom: dateFrom.toISOString(),
    DateTo: now.toISOString(),
    MaxNumberOfRecords: limit,
    PageNumber: 0,
  };

  const response = await fetch(`${EZRADIUS_API_URL}/api/Logs/GetAuthAuditLogs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${EZRADIUS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`EZRADIUS API error: ${response.status} ${response.statusText}`);
  }

  const data: EzradiusAuthLogEntry[] = await response.json();
  
  return data
    .filter(entry => entry.authResult === 'Access-Accept')
    .map(entry => ({
      id: entry.id || `${entry.timestamp}-${entry.username}`,
      timestamp: entry.timestamp,
      username: entry.username,
      nas_ip: entry.nasIpAddress || '',
      nas_identifier: entry.nasIdentifier || '',
      calling_station_id: entry.callingStationId || '',
      event_type: 'Access-Accept' as const,
      location: entry.location,
    }));
}

export async function fetchLocalServers(): Promise<Array<{ id: string; name: string; ipAddress: string }>> {
  const response = await fetch(`${EZRADIUS_API_URL}/api/LocalServers`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${EZRADIUS_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`EZRADIUS API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
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
