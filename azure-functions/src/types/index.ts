export interface Office {
  id: string;
  name: string;
  location: string;
  capacity: number;
  timezone: string;
  unifi_site_id?: string;
  ezradius_location_id?: string;
}

export interface User {
  id: string;
  entra_id: string;
  email: string;
  display_name: string;
  department?: string;
  job_title?: string;
}

export interface AccessEvent {
  id: string;
  user_id: string;
  office_id: string;
  event_type: 'entry' | 'exit';
  source: 'unifi_access' | 'ezradius';
  device_info?: string;
  raw_event_id?: string;
  timestamp: Date;
}

export interface PresenceSession {
  id: string;
  user_id: string;
  office_id: string;
  entry_time: Date;
  exit_time?: Date;
  duration_minutes?: number;
}

export interface DailyAttendance {
  office_id: string;
  date: string;
  unique_visitors: number;
  total_entries: number;
  average_duration_minutes: number;
  peak_occupancy: number;
}

export interface UnifiAccessEvent {
  id: string;
  actor_id: string;
  event_type: string;
  door_id: string;
  timestamp: number;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface EzradiusAuthEvent {
  id: string;
  username: string;
  mac_address: string;
  nas_ip: string;
  event_type: string;
  timestamp: string;
  location_id?: string;
}
