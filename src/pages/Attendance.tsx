import { useState, useEffect } from 'react';
import { subDays, format, parseISO } from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { OfficeSelector, DateRangePicker } from '@/components';
import { getOffices, getAttendance, type Office, type DailyAttendance } from '@/services/api';

export function Attendance() {
  const [selectedOfficeIds, setSelectedOfficeIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 29),
    end: new Date(),
  });
  const [offices, setOffices] = useState<Office[]>([]);
  const [dailyAttendance, setDailyAttendance] = useState<DailyAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [officesData, attendanceData] = await Promise.all([
          getOffices(),
          getAttendance(
            format(dateRange.start, 'yyyy-MM-dd'),
            format(dateRange.end, 'yyyy-MM-dd')
          ),
        ]);
        setOffices(officesData);
        setSelectedOfficeIds(officesData.map((o) => o.id));
        setDailyAttendance(attendanceData);
      } catch (error) {
        console.error('Failed to fetch attendance data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [dateRange]);

  const chartData = (() => {
    const dateMap: Record<string, { date: string; total: number; [key: string]: string | number }> = {};

    for (const record of dailyAttendance) {
      if (!selectedOfficeIds.includes(record.officeId)) continue;

      const dateStr = record.date;
      if (!dateMap[dateStr]) {
        dateMap[dateStr] = { date: dateStr, total: 0 };
      }

      const office = offices.find((o) => o.id === record.officeId);
      if (office) {
        dateMap[dateStr][office.name] = record.uniqueVisitors;
        dateMap[dateStr].total += record.uniqueVisitors;
      }
    }

    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
  })();

  const colors = ['#005596', '#5BC2A7', '#F5BB41', '#9D1D96', '#4597D3', '#A7A8A9'];

  const selectedOffices = offices.filter((o) => selectedOfficeIds.includes(o.id));

  const summaryStats = (() => {
    const filtered = dailyAttendance.filter((d) => selectedOfficeIds.includes(d.officeId));
    const totalVisitors = filtered.reduce((sum, d) => sum + d.uniqueVisitors, 0);
    const daysCount = new Set(filtered.map(d => d.date)).size || 1;
    const avgDaily = Math.round(totalVisitors / daysCount);
    const peakDay = filtered.reduce(
      (max, d) => (d.uniqueVisitors > max.visitors ? { date: d.date, visitors: d.uniqueVisitors } : max),
      { date: '', visitors: 0 }
    );
    const avgDuration = filtered.length > 0 
      ? Math.round(filtered.reduce((sum, d) => sum + d.averageDurationMinutes, 0) / filtered.length)
      : 0;

    return { totalVisitors, avgDaily, peakDay, avgDuration };
  })();

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
          <h1 className="text-2xl font-bold text-slate-900">Attendance Trends</h1>
          <p className="text-slate-500 mt-1">Analyze office attendance patterns over time</p>
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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm font-medium text-slate-500">Total Visitors (30d)</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{summaryStats.totalVisitors.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm font-medium text-slate-500">Daily Average</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{summaryStats.avgDaily}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm font-medium text-slate-500">Peak Day</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{summaryStats.peakDay.visitors}</p>
          <p className="text-sm text-slate-500">
            {summaryStats.peakDay.date && format(parseISO(summaryStats.peakDay.date), 'MMM d')}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm font-medium text-slate-500">Avg. Stay Duration</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {Math.floor(summaryStats.avgDuration / 60)}h {summaryStats.avgDuration % 60}m
          </p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Daily Attendance by Office</h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={12}
                tickFormatter={(value) => format(parseISO(value), 'MMM d')}
              />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                labelFormatter={(value) => format(parseISO(value as string), 'EEEE, MMM d, yyyy')}
              />
              <Legend />
              {selectedOffices.map((office, index) => (
                <Area
                  key={office.id}
                  type="monotone"
                  dataKey={office.name}
                  stackId="1"
                  stroke={colors[index % colors.length]}
                  fill={colors[index % colors.length]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Office Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Office Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Office
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Total Visitors
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Daily Avg
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Capacity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Utilization
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {selectedOffices.map((office) => {
                const officeData = dailyAttendance.filter((d) => d.officeId === office.id);
                const totalVisitors = officeData.reduce((sum, d) => sum + d.uniqueVisitors, 0);
                const dailyAvg = Math.round(totalVisitors / 30);
                const utilization = Math.round((dailyAvg / office.capacity) * 100);

                return (
                  <tr key={office.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{office.name}</p>
                        <p className="text-xs text-slate-500">{office.location}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {totalVisitors.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{dailyAvg}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{office.capacity}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              utilization > 80
                                ? 'bg-red-500'
                                : utilization > 60
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(utilization, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-slate-600">{utilization}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
