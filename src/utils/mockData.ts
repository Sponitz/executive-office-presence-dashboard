import type {
  User,
  Office,
  DailyAttendance,
  HourlyOccupancy,
  UserPresenceSummary,
  DashboardStats,
} from '@/types';

export const mockOffices: Office[] = [
  { id: 'office-1', name: 'Dallas HQ', location: 'Plano, TX', capacity: 150, timezone: 'America/Chicago' },
  { id: 'office-2', name: 'Atlanta', location: 'Alpharetta, GA', capacity: 80, timezone: 'America/New_York' },
  { id: 'office-3', name: 'Austin', location: 'Austin, TX', capacity: 60, timezone: 'America/Chicago' },
  { id: 'office-4', name: 'Chicago', location: 'Chicago, IL', capacity: 70, timezone: 'America/Chicago' },
  { id: 'office-5', name: 'Cleveland', location: 'Independence, OH', capacity: 50, timezone: 'America/New_York' },
  { id: 'office-6', name: 'Columbus', location: 'Columbus, OH', capacity: 50, timezone: 'America/New_York' },
  { id: 'office-7', name: 'Houston', location: 'Houston, TX', capacity: 80, timezone: 'America/Chicago' },
  { id: 'office-8', name: 'Minneapolis', location: 'Minneapolis, MN', capacity: 60, timezone: 'America/Chicago' },
  { id: 'office-9', name: 'Omaha', location: 'Omaha, NE', capacity: 40, timezone: 'America/Chicago' },
  { id: 'office-10', name: 'Calgary', location: 'Calgary, AB', capacity: 50, timezone: 'America/Edmonton' },
  { id: 'office-11', name: 'Ottawa', location: 'Ottawa, ON', capacity: 50, timezone: 'America/Toronto' },
  { id: 'office-12', name: 'Vancouver', location: 'Vancouver, BC', capacity: 50, timezone: 'America/Vancouver' },
  { id: 'office-13', name: 'Toronto', location: 'Toronto, ON', capacity: 60, timezone: 'America/Toronto' },
  { id: 'office-14', name: 'Winnipeg', location: 'Winnipeg, MB', capacity: 40, timezone: 'America/Winnipeg' },
  { id: 'office-15', name: 'Aguascalientes', location: 'Aguascalientes, MX', capacity: 40, timezone: 'America/Mexico_City' },
  { id: 'office-16', name: 'Guadalajara', location: 'Guadalajara, MX', capacity: 50, timezone: 'America/Mexico_City' },
  { id: 'office-17', name: 'Buenos Aires', location: 'Buenos Aires, AR', capacity: 40, timezone: 'America/Argentina/Buenos_Aires' },
  { id: 'office-18', name: 'Santiago', location: 'Santiago, CL', capacity: 40, timezone: 'America/Santiago' },
  { id: 'office-19', name: 'Guatemala City', location: 'Guatemala City, GT', capacity: 30, timezone: 'America/Guatemala' },
  { id: 'office-20', name: 'Pune', location: 'Pune, IN', capacity: 50, timezone: 'Asia/Kolkata' },
];

export const mockUsers: User[] = [
  { id: 'user-1', email: 'john.smith@company.com', displayName: 'John Smith', department: 'Engineering', jobTitle: 'Senior Developer' },
  { id: 'user-2', email: 'sarah.johnson@company.com', displayName: 'Sarah Johnson', department: 'Marketing', jobTitle: 'Marketing Director' },
  { id: 'user-3', email: 'mike.williams@company.com', displayName: 'Mike Williams', department: 'Sales', jobTitle: 'Sales Manager' },
  { id: 'user-4', email: 'emily.brown@company.com', displayName: 'Emily Brown', department: 'HR', jobTitle: 'HR Specialist' },
  { id: 'user-5', email: 'david.jones@company.com', displayName: 'David Jones', department: 'Finance', jobTitle: 'Financial Analyst' },
  { id: 'user-6', email: 'lisa.davis@company.com', displayName: 'Lisa Davis', department: 'Engineering', jobTitle: 'Tech Lead' },
  { id: 'user-7', email: 'robert.miller@company.com', displayName: 'Robert Miller', department: 'Operations', jobTitle: 'Operations Manager' },
  { id: 'user-8', email: 'jennifer.wilson@company.com', displayName: 'Jennifer Wilson', department: 'Legal', jobTitle: 'Legal Counsel' },
  { id: 'user-9', email: 'chris.moore@company.com', displayName: 'Chris Moore', department: 'Engineering', jobTitle: 'DevOps Engineer' },
  { id: 'user-10', email: 'amanda.taylor@company.com', displayName: 'Amanda Taylor', department: 'Product', jobTitle: 'Product Manager' },
];

export function generateDailyAttendance(days: number = 30): DailyAttendance[] {
  const data: DailyAttendance[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    for (const office of mockOffices) {
      const baseVisitors = isWeekend ? 5 : Math.floor(office.capacity * 0.6);
      const variance = Math.floor(Math.random() * 20) - 10;

      data.push({
        date: dateStr,
        officeId: office.id,
        uniqueVisitors: Math.max(0, baseVisitors + variance),
        totalEntries: Math.max(0, baseVisitors + variance + Math.floor(Math.random() * 10)),
        averageDurationMinutes: 300 + Math.floor(Math.random() * 180),
        peakOccupancy: Math.min(office.capacity, baseVisitors + variance + 15),
      });
    }
  }

  return data;
}

export function generateHourlyOccupancy(): HourlyOccupancy[] {
  const data: HourlyOccupancy[] = [];

  for (const office of mockOffices) {
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      for (let hour = 0; hour < 24; hour++) {
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isWorkHours = hour >= 8 && hour <= 18;
        const isPeakHours = hour >= 9 && hour <= 11 || hour >= 14 && hour <= 16;

        let baseOccupancy = 0;
        if (!isWeekend && isWorkHours) {
          baseOccupancy = isPeakHours ? office.capacity * 0.7 : office.capacity * 0.4;
        } else if (!isWeekend && (hour === 7 || hour === 19)) {
          baseOccupancy = office.capacity * 0.15;
        } else if (isWeekend && isWorkHours) {
          baseOccupancy = office.capacity * 0.05;
        }

        data.push({
          hour,
          dayOfWeek,
          averageOccupancy: Math.floor(baseOccupancy + Math.random() * 10),
          officeId: office.id,
        });
      }
    }
  }

  return data;
}

export function generateUserPresenceSummaries(): UserPresenceSummary[] {
  return mockUsers.map((user) => {
    const totalVisits = 10 + Math.floor(Math.random() * 20);
    const totalMinutes = totalVisits * (240 + Math.floor(Math.random() * 180));
    const primaryOfficeIndex = Math.floor(Math.random() * mockOffices.length);

    return {
      userId: user.id,
      user,
      totalVisits,
      totalMinutes,
      averageMinutesPerVisit: Math.floor(totalMinutes / totalVisits),
      lastVisit: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
      primaryOffice: mockOffices[primaryOfficeIndex].name,
    };
  });
}

export function generateDashboardStats(): DashboardStats {
  const totalCapacity = mockOffices.reduce((sum, o) => sum + o.capacity, 0);
  const currentOccupancy = Math.floor(totalCapacity * (0.3 + Math.random() * 0.3));

  return {
    currentOccupancy,
    totalCapacity,
    averageDailyAttendance: Math.floor(totalCapacity * 0.55),
    averageStayDuration: 320 + Math.floor(Math.random() * 60),
    weekOverWeekChange: -5 + Math.floor(Math.random() * 15),
    activeOffices: mockOffices.length,
  };
}

export function getWeeklyTrendData() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((day, index) => {
    const isWeekend = index >= 5;
    const baseAttendance = isWeekend ? 15 : 180 + Math.floor(Math.random() * 40);
    return {
      day,
      thisWeek: baseAttendance,
      lastWeek: baseAttendance + Math.floor(Math.random() * 30) - 15,
    };
  });
}

export function getOfficeComparisonData() {
  return mockOffices.map((office) => {
    const occupancyRate = 0.4 + Math.random() * 0.35;
    return {
      name: office.name,
      current: Math.floor(office.capacity * occupancyRate),
      capacity: office.capacity,
      occupancyRate: Math.floor(occupancyRate * 100),
    };
  });
}
