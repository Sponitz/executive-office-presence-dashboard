import { useState, useMemo } from 'react';
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
  mockOffices,
  generateDashboardStats,
  getWeeklyTrendData,
  getOfficeComparisonData,
  generateHourlyOccupancy,
  generateUserPresenceSummaries,
} from '@/utils/mockData';

export function Dashboard() {
  const [selectedOfficeIds, setSelectedOfficeIds] = useState<string[]>(
    mockOffices.map((o) => o.id)
  );
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 29),
    end: new Date(),
  });

  const stats = useMemo(() => generateDashboardStats(), []);
  const weeklyTrend = useMemo(() => getWeeklyTrendData(), []);
  const officeComparison = useMemo(() => getOfficeComparisonData(), []);
  const hourlyOccupancy = useMemo(() => generateHourlyOccupancy(), []);
  const userPresence = useMemo(() => generateUserPresenceSummaries(), []);

  const filteredHourlyOccupancy = useMemo(() => {
    if (selectedOfficeIds.length === 0) return [];
    return hourlyOccupancy.filter((h) => selectedOfficeIds.includes(h.officeId));
  }, [hourlyOccupancy, selectedOfficeIds]);

  const aggregatedHourlyOccupancy = useMemo(() => {
    const aggregated: Record<string, { hour: number; dayOfWeek: number; averageOccupancy: number }> = {};
    
    for (const item of filteredHourlyOccupancy) {
      const key = `${item.dayOfWeek}-${item.hour}`;
      if (!aggregated[key]) {
        aggregated[key] = { hour: item.hour, dayOfWeek: item.dayOfWeek, averageOccupancy: 0 };
      }
      aggregated[key].averageOccupancy += item.averageOccupancy;
    }
    
    return Object.values(aggregated);
  }, [filteredHourlyOccupancy]);

  const maxOccupancy = useMemo(() => {
    return Math.max(...aggregatedHourlyOccupancy.map((h) => h.averageOccupancy), 1);
  }, [aggregatedHourlyOccupancy]);

  const filteredOfficeComparison = useMemo(() => {
    return officeComparison.filter((o) => {
      const office = mockOffices.find((mo) => mo.name === o.name);
      return office && selectedOfficeIds.includes(office.id);
    });
  }, [officeComparison, selectedOfficeIds]);

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
            offices={mockOffices}
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
        <WeeklyTrendChart data={weeklyTrend} />
        <OfficeComparisonChart data={filteredOfficeComparison} />
      </div>

      {/* Heatmap */}
      <PeakHoursHeatmap data={aggregatedHourlyOccupancy} maxOccupancy={maxOccupancy} />

      {/* Top Visitors Table */}
      <DataTable data={userPresence} title="Top Office Visitors" />
    </div>
  );
}
