export interface User {
  id: string;
  email: string;
  displayName: string;
  department?: string;
  jobTitle?: string;
  photoUrl?: string;
}

export interface Office {
  id: string;
  name: string;
  location: string;
  capacity: number;
  timezone: string;
}

export interface AccessEvent {
  id: string;
  userId: string;
  officeId: string;
  eventType: 'entry' | 'exit';
  timestamp: Date;
  source: 'unifi_access' | 'ezradius';
  deviceInfo?: string;
}

export interface PresenceSession {
  id: string;
  userId: string;
  officeId: string;
  entryTime: Date;
  exitTime?: Date;
  durationMinutes?: number;
}

export interface DailyAttendance {
  date: string;
  officeId: string;
  uniqueVisitors: number;
  totalEntries: number;
  averageDurationMinutes: number;
  peakOccupancy: number;
}

export interface HourlyOccupancy {
  hour: number;
  dayOfWeek: number;
  averageOccupancy: number;
  officeId: string;
}

export interface UserPresenceSummary {
  userId: string;
  user: User;
  totalVisits: number;
  totalMinutes: number;
  averageMinutesPerVisit: number;
  lastVisit?: Date;
  primaryOffice?: string;
}

export type UserRole = 'executive' | 'manager' | 'viewer';

export interface AuthenticatedUser extends User {
  role: UserRole;
  securityGroups: string[];
}

export interface DashboardFilters {
  officeIds: string[];
  dateRange: {
    start: Date;
    end: Date;
  };
  userId?: string;
}

export interface DashboardStats {
  currentOccupancy: number;
  totalCapacity: number;
  averageDailyAttendance: number;
  averageStayDuration: number;
  weekOverWeekChange: number;
  activeOffices: number;
}
