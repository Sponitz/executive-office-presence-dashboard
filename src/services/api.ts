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

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

export async function getOffices(): Promise<Office[]> {
  try {
    const data = await fetchApi<{ offices: Office[] }>('/offices');
    return data.offices || [];
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
    const data = await fetchApi<{ attendance: DailyAttendance[] }>(url);
    return data.attendance || [];
  } catch (error) {
    console.error('Failed to fetch attendance:', error);
    return [];
  }
}

export async function getHourlyOccupancy(): Promise<HourlyOccupancy[]> {
  try {
    const data = await fetchApi<{ occupancy: HourlyOccupancy[] }>('/hourly-occupancy');
    return data.occupancy || [];
  } catch (error) {
    console.error('Failed to fetch hourly occupancy:', error);
    return [];
  }
}

export async function getUsers(): Promise<User[]> {
  try {
    const data = await fetchApi<{ users: User[] }>('/users');
    return data.users || [];
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return [];
  }
}
