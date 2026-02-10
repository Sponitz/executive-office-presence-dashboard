const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://improving-pulse-functions.azurewebsites.net/api';

export interface Office {
  id: string;
  name: string;
  location: string;
  capacity: number;
  timezone: string;
  address?: string;
  phone?: string;
  country?: string;
  current_occupancy?: number;
  occupancy_rate?: number;
}

export interface DashboardStats {
  currentOccupancy: number;
  totalCapacity: number;
  averageDailyAttendance: number;
  averageStayDuration: number;
  weekOverWeekChange: number;
  activeOffices: number;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  department?: string;
  jobTitle?: string;
}

export interface DailyAttendance {
  date: string;
  office_id: string;
  office_name: string;
  unique_visitors: number;
  total_entries: number;
  average_duration_minutes: number;
  peak_occupancy: number;
}

export interface HourlyOccupancy {
  hour: number;
  day_of_week: number;
  average_occupancy: number;
  office_id: string;
}

export interface UserPresenceSummary {
  user_id: string;
  display_name: string;
  email: string;
  total_visits: number;
  total_minutes: number;
  average_minutes_per_visit: number;
  last_visit: string | null;
  primary_office: string | null;
}

export interface WeeklyTrendData {
  date: string;
  unique_visitors: number;
}

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

export async function getOffices(): Promise<Office[]> {
  try {
    return await fetchApi<Office[]>('/offices');
  } catch (error) {
    console.error('Failed to fetch offices:', error);
    return [];
  }
}

export async function getStats(): Promise<DashboardStats> {
  try {
    return await fetchApi<DashboardStats>('/stats');
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return {
      currentOccupancy: 0,
      totalCapacity: 0,
      averageDailyAttendance: 0,
      averageStayDuration: 0,
      weekOverWeekChange: 0,
      activeOffices: 0,
    };
  }
}

export async function getAttendance(startDate?: string, endDate?: string): Promise<DailyAttendance[]> {
  try {
    let url = '/attendance';
    if (startDate && endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }
    return await fetchApi<DailyAttendance[]>(url);
  } catch (error) {
    console.error('Failed to fetch attendance:', error);
    return [];
  }
}

export async function getHourlyOccupancy(): Promise<HourlyOccupancy[]> {
  try {
    return await fetchApi<HourlyOccupancy[]>('/hourly-occupancy');
  } catch (error) {
    console.error('Failed to fetch hourly occupancy:', error);
    return [];
  }
}

export async function getUsers(): Promise<User[]> {
  try {
    const data = await fetchApi<{ users: User[]; total: number }>('/users');
    return data.users || [];
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return [];
  }
}

export async function getUserPresence(): Promise<UserPresenceSummary[]> {
  try {
    return await fetchApi<UserPresenceSummary[]>('/user-presence');
  } catch (error) {
    console.error('Failed to fetch user presence:', error);
    return [];
  }
}

export async function getWeeklyTrends(): Promise<WeeklyTrendData[]> {
  try {
    return await fetchApi<WeeklyTrendData[]>('/weekly-trends');
  } catch (error) {
    console.error('Failed to fetch weekly trends:', error);
    return [];
  }
}
