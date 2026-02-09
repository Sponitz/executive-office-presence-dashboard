import { useState, useEffect } from 'react';
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
  getUserPresence,
  getWeeklyTrends,
  type DashboardStats,
  type Office,
  type HourlyOccupancy,
  type UserPresenceSummary,
  type WeeklyTrendData,
} from '@/services/api';

export function Dashboard() {
  const [selectedOfficeIds, setSelectedOfficeIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 29),
    end: new Date(),
  });
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    currentOccupancy: 0,
    totalCapacity: 0,
    averageDailyAttendance: 0,
    averageStayDuration: 0,
    weekOverWeekChange: 0,
    activeOffices: 0,
  });
  const [offices, setOffices] = useState<Office[]>([]);
  const [hourlyOccupancy, setHourlyOccupancy] = useState<HourlyOccupancy[]>([]);
  const [userPresence, setUserPresence] = useState<UserPresenceSummary[]>([]);
  const [officeComparison, setOfficeComparison] = useState<{ name: string; current: number; capacity: number; occupancyRate: number }[]>([]);
  const [weeklyTrends, setWeeklyTrends] = useState<WeeklyTrendData[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
                const [statsData, officesData, hourlyData, presenceData, trendsData] = await Promise.all([
                  getStats(),
                  getOffices(),
                  getHourlyOccupancy(),
                  getUserPresence(),
                  getWeeklyTrends(),
                ]);

                setStats(statsData);
                setOffices(officesData);
                setSelectedOfficeIds(officesData.map((o) => o.id));
                setHourlyOccupancy(hourlyData);
                setUserPresence(presenceData);
                setWeeklyTrends(trendsData);

        const comparison = officesData.map((office) => ({
          name: office.name,
          current: 0,
          capacity: office.capacity,
          occupancyRate: 0,
        }));
        setOfficeComparison(comparison);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const filteredHourlyOccupancy = selectedOfficeIds.length === 0 
    ? [] 
    : hourlyOccupancy.filter((h) => selectedOfficeIds.includes(h.officeId));

  const aggregatedHourlyOccupancy = (() => {
    const aggregated: Record<string, { hour: number; dayOfWeek: number; averageOccupancy: number }> = {};
    
    for (const item of filteredHourlyOccupancy) {
      const key = `${item.dayOfWeek}-${item.hour}`;
      if (!aggregated[key]) {
        aggregated[key] = { hour: item.hour, dayOfWeek: item.dayOfWeek, averageOccupancy: 0 };
      }
      aggregated[key].averageOccupancy += item.averageOccupancy;
    }
    
    return Object.values(aggregated);
  })();

  const maxOccupancy = Math.max(...aggregatedHourlyOccupancy.map((h) => h.averageOccupancy), 1);

  const filteredOfficeComparison = officeComparison.filter((o) => {
    const office = offices.find((mo) => mo.name === o.name);
    return office && selectedOfficeIds.includes(office.id);
  });

  const userPresenceForTable = userPresence.map((up) => ({
    userId: up.userId,
    user: {
      id: up.userId,
      email: up.email,
      displayName: up.displayName,
    },
    totalVisits: up.totalVisits,
    totalMinutes: up.totalMinutes,
    averageMinutesPerVisit: up.averageMinutesPerVisit,
    lastVisit: up.lastVisit ? new Date(up.lastVisit) : undefined,
    primaryOffice: up.primaryOffice || undefined,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#005596]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Improving Pulse</h1>
          <p className="text-slate-500 mt-1">The pulse of Improving - office presence across all locations</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <OfficeSelector
            offices={offices}
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

      {/* Stats Grid */}
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeeklyTrendChart data={weeklyTrends.map(t => ({ date: t.date, visitors: Number(t.unique_visitors) }))} />
        <OfficeComparisonChart data={filteredOfficeComparison} />
      </div>

      {/* Heatmap */}
      <PeakHoursHeatmap data={aggregatedHourlyOccupancy} maxOccupancy={maxOccupancy} />

      {/* Top Visitors Table */}
      <DataTable data={userPresenceForTable} title="Top Office Visitors" />
    </div>
  );
}
