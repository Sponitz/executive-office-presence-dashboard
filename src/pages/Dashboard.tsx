import { useState, useEffect, useMemo } from 'react';
import { Users, Clock, TrendingUp, Building2 } from 'lucide-react';
import { subDays } from 'date-fns';
import {
  StatCard,
  WeeklyTrendChart,
  OfficeComparisonChart,
  PeakHoursHeatmap,
  DataTable,
  OfficeSelector,
  DateRangePicker,
} from '@/components';
import {
  getStats,
  getOffices,
  getHourlyOccupancy,
  getWeeklyTrends,
  getUserPresence,
} from '@/services/api';
import type { DashboardStats, Office, HourlyOccupancy as HourlyOccupancyType, UserPresenceSummary } from '@/services/api';

export function Dashboard() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOfficeIds, setSelectedOfficeIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 29),
    end: new Date(),
  });
  const [stats, setStats] = useState<DashboardStats>({
    currentOccupancy: 0,
    totalCapacity: 0,
    averageDailyAttendance: 0,
    averageStayDuration: 0,
    weekOverWeekChange: 0,
    activeOffices: 0,
  });
  const [weeklyTrend, setWeeklyTrend] = useState<Array<{ day: string; thisWeek: number; lastWeek: number }>>([]);
  const [hourlyOccupancy, setHourlyOccupancy] = useState<HourlyOccupancyType[]>([]);
  const [userPresence, setUserPresence] = useState<UserPresenceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [statsData, officesData, hourlyData, trendsData, presenceData] = await Promise.all([
          getStats(),
          getOffices(),
          getHourlyOccupancy(),
          getWeeklyTrends(),
          getUserPresence(),
        ]);

        setStats(statsData);
        setOffices(officesData);
        setSelectedOfficeIds(officesData.map((o) => o.id));
        setHourlyOccupancy(hourlyData);
        setUserPresence(presenceData);

        if (trendsData.length > 0) {
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const grouped: Record<string, { thisWeek: number; lastWeek: number }> = {};
          for (const d of dayNames) {
            grouped[d] = { thisWeek: 0, lastWeek: 0 };
          }
          const now = new Date();
          for (const item of trendsData) {
            const date = new Date(item.date);
            const dayName = dayNames[date.getDay()];
            const daysAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
            if (daysAgo <= 7) {
              grouped[dayName].thisWeek += item.unique_visitors;
            } else if (daysAgo <= 14) {
              grouped[dayName].lastWeek += item.unique_visitors;
            }
          }
          setWeeklyTrend(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({
            day,
            thisWeek: grouped[day].thisWeek,
            lastWeek: grouped[day].lastWeek,
          })));
        }
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const officeComparison = useMemo(() => {
    return offices.map((o) => ({
      name: o.name,
      current: o.current_occupancy || 0,
      capacity: o.capacity,
      occupancyRate: o.occupancy_rate || 0,
    }));
  }, [offices]);

  const filteredHourlyOccupancy = useMemo(() => {
    if (selectedOfficeIds.length === 0) return [];
    return hourlyOccupancy.filter((h) => selectedOfficeIds.includes(h.office_id));
  }, [hourlyOccupancy, selectedOfficeIds]);

  const aggregatedHourlyOccupancy = useMemo(() => {
    const aggregated: Record<string, { hour: number; dayOfWeek: number; averageOccupancy: number }> = {};

    for (const item of filteredHourlyOccupancy) {
      const key = `${item.day_of_week}-${item.hour}`;
      if (!aggregated[key]) {
        aggregated[key] = { hour: item.hour, dayOfWeek: Number(item.day_of_week), averageOccupancy: 0 };
      }
      aggregated[key].averageOccupancy += Number(item.average_occupancy);
    }

    return Object.values(aggregated);
  }, [filteredHourlyOccupancy]);

  const maxOccupancy = useMemo(() => {
    return Math.max(...aggregatedHourlyOccupancy.map((h) => h.averageOccupancy), 1);
  }, [aggregatedHourlyOccupancy]);

  const filteredOfficeComparison = useMemo(() => {
    return officeComparison.filter((o) => {
      const office = offices.find((mo) => mo.name === o.name);
      return office && selectedOfficeIds.includes(office.id);
    });
  }, [officeComparison, offices, selectedOfficeIds]);

  const mappedUserPresence = useMemo(() => {
    return userPresence.map((p) => ({
      userId: p.user_id,
      user: {
        id: p.user_id,
        email: p.email,
        displayName: p.display_name,
      },
      totalVisits: p.total_visits,
      totalMinutes: p.total_minutes,
      averageMinutesPerVisit: p.average_minutes_per_visit,
      lastVisit: p.last_visit ? new Date(p.last_visit) : undefined,
      primaryOffice: p.primary_office || undefined,
    }));
  }, [userPresence]);

  const mappedOffices = useMemo(() => {
    return offices.map((o) => ({
      id: o.id,
      name: o.name,
      location: o.location,
      capacity: o.capacity,
      timezone: o.timezone,
    }));
  }, [offices]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Improving Pulse</h1>
          <p className="text-slate-500 mt-1">The pulse of Improving - office presence across all locations</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <OfficeSelector
            offices={mappedOffices}
            selectedOfficeIds={selectedOfficeIds}
            onChange={setSelectedOfficeIds}
          />
          <DateRangePicker
            startDate={dateRange.start}
            endDate={dateRange.end}
            onChange={(start, end) => setDateRange({ start, end })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Current Occupancy"
          value={stats.currentOccupancy}
          subtitle={`of ${stats.totalCapacity} capacity`}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Avg. Stay Duration"
          value={`${Math.floor(stats.averageStayDuration / 60)}h ${stats.averageStayDuration % 60}m`}
          subtitle="per visit"
          icon={Clock}
          color="green"
        />
        <StatCard
          title="Daily Attendance"
          value={stats.averageDailyAttendance}
          subtitle="average visitors"
          icon={TrendingUp}
          trend={{ value: stats.weekOverWeekChange, label: 'vs last week' }}
          color="purple"
        />
        <StatCard
          title="Active Offices"
          value={stats.activeOffices}
          subtitle="locations tracked"
          icon={Building2}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeeklyTrendChart data={weeklyTrend} />
        <OfficeComparisonChart data={filteredOfficeComparison} />
      </div>

      <PeakHoursHeatmap data={aggregatedHourlyOccupancy} maxOccupancy={maxOccupancy} />

      <DataTable data={mappedUserPresence} title="Top Office Visitors" />
    </div>
  );
}
