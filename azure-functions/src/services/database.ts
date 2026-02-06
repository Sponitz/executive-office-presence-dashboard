import { Pool } from 'pg';
import type { AccessEvent, DailyAttendance, Office, PresenceSession, User } from '../types/index.js';

const pool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function getOffices(): Promise<Office[]> {
  const result = await pool.query('SELECT * FROM offices WHERE is_active = true');
  return result.rows;
}

export async function getOfficeByUnifiSiteId(siteId: string): Promise<Office | null> {
  const result = await pool.query(
    'SELECT * FROM offices WHERE unifi_site_id = $1 AND is_active = true',
    [siteId]
  );
  return result.rows[0] || null;
}

export async function getOfficeByEzradiusLocationId(locationId: string): Promise<Office | null> {
  const result = await pool.query(
    'SELECT * FROM offices WHERE ezradius_location_id = $1 AND is_active = true',
    [locationId]
  );
  return result.rows[0] || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  return result.rows[0] || null;
}

export async function getUserByEntraId(entraId: string): Promise<User | null> {
  const result = await pool.query('SELECT * FROM users WHERE entra_id = $1', [entraId]);
  return result.rows[0] || null;
}

export async function upsertUser(user: Omit<User, 'id'>): Promise<User> {
  const result = await pool.query(
    `INSERT INTO users (entra_id, email, display_name, department, job_title)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (entra_id) DO UPDATE SET
       email = EXCLUDED.email,
       display_name = EXCLUDED.display_name,
       department = EXCLUDED.department,
       job_title = EXCLUDED.job_title,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [user.entra_id, user.email.toLowerCase(), user.display_name, user.department, user.job_title]
  );
  return result.rows[0];
}

export async function insertAccessEvent(event: Omit<AccessEvent, 'id'>): Promise<AccessEvent> {
  const result = await pool.query(
    `INSERT INTO access_events (user_id, office_id, event_type, source, device_info, raw_event_id, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [event.user_id, event.office_id, event.event_type, event.source, event.device_info, event.raw_event_id, event.timestamp]
  );
  return result.rows[0];
}

export async function checkEventExists(rawEventId: string, source: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM access_events WHERE raw_event_id = $1 AND source = $2',
    [rawEventId, source]
  );
  return result.rows.length > 0;
}

export async function getOpenSession(userId: string, officeId: string): Promise<PresenceSession | null> {
  const result = await pool.query(
    `SELECT * FROM presence_sessions 
     WHERE user_id = $1 AND office_id = $2 AND exit_time IS NULL
     ORDER BY entry_time DESC LIMIT 1`,
    [userId, officeId]
  );
  return result.rows[0] || null;
}

export async function createSession(userId: string, officeId: string, entryTime: Date): Promise<PresenceSession> {
  const result = await pool.query(
    `INSERT INTO presence_sessions (user_id, office_id, entry_time)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, officeId, entryTime]
  );
  return result.rows[0];
}

export async function closeSession(sessionId: string, exitTime: Date): Promise<PresenceSession> {
  const result = await pool.query(
    `UPDATE presence_sessions 
     SET exit_time = $2, 
         duration_minutes = EXTRACT(EPOCH FROM ($2 - entry_time)) / 60,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [sessionId, exitTime]
  );
  return result.rows[0];
}

export async function getDailyAttendance(officeId: string, startDate: string, endDate: string): Promise<DailyAttendance[]> {
  const result = await pool.query(
    `SELECT * FROM daily_attendance 
     WHERE office_id = $1 AND date >= $2 AND date <= $3
     ORDER BY date`,
    [officeId, startDate, endDate]
  );
  return result.rows;
}

export async function upsertDailyAttendance(data: DailyAttendance): Promise<void> {
  await pool.query(
    `INSERT INTO daily_attendance (office_id, date, unique_visitors, total_entries, average_duration_minutes, peak_occupancy)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (office_id, date) DO UPDATE SET
       unique_visitors = EXCLUDED.unique_visitors,
       total_entries = EXCLUDED.total_entries,
       average_duration_minutes = EXCLUDED.average_duration_minutes,
       peak_occupancy = EXCLUDED.peak_occupancy,
       updated_at = CURRENT_TIMESTAMP`,
    [data.office_id, data.date, data.unique_visitors, data.total_entries, data.average_duration_minutes, data.peak_occupancy]
  );
}

export async function updateSyncStatus(source: string, status: string, lastEventTimestamp?: Date, errorMessage?: string): Promise<void> {
  await pool.query(
    `INSERT INTO sync_status (source, status, last_sync_at, last_event_timestamp, error_message)
     VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)
     ON CONFLICT (source) DO UPDATE SET
       status = EXCLUDED.status,
       last_sync_at = CURRENT_TIMESTAMP,
       last_event_timestamp = COALESCE(EXCLUDED.last_event_timestamp, sync_status.last_event_timestamp),
       error_message = EXCLUDED.error_message,
       updated_at = CURRENT_TIMESTAMP`,
    [source, status, lastEventTimestamp, errorMessage]
  );
}

export async function getLastSyncTimestamp(source: string): Promise<Date | null> {
  const result = await pool.query(
    'SELECT last_event_timestamp FROM sync_status WHERE source = $1',
    [source]
  );
  return result.rows[0]?.last_event_timestamp || null;
}
