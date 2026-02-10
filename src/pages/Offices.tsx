import { useState, useEffect, useMemo } from 'react';
import { MapPin, Users, Clock, TrendingUp } from 'lucide-react';
import { getOffices, getAttendance } from '@/services/api';
import type { Office, DailyAttendance } from '@/services/api';

export function Offices() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [attendance, setAttendance] = useState<DailyAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [officesData, attendanceData] = await Promise.all([
          getOffices(),
          getAttendance(),
        ]);
        setOffices(officesData);
        setAttendance(attendanceData);
      } catch (error) {
        console.error('Failed to load offices data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const officeStats = useMemo(() => {
    return offices.map((office) => {
      const officeData = attendance.filter((d) => d.office_id === office.id);
      const totalVisitors = officeData.reduce((sum, d) => sum + (d.unique_visitors || 0), 0);
      const days = officeData.length || 1;
      const avgDaily = Math.round(totalVisitors / days);
      const avgDuration = officeData.length > 0
        ? Math.round(officeData.reduce((sum, d) => sum + (d.average_duration_minutes || 0), 0) / officeData.length)
        : 0;
      const peakOccupancy = officeData.length > 0
        ? Math.max(...officeData.map((d) => d.peak_occupancy || 0))
        : 0;

      return {
        ...office,
        totalVisitors,
        avgDaily,
        avgDuration,
        peakOccupancy,
        currentOccupancy: office.current_occupancy || 0,
        occupancyRate: office.occupancy_rate || 0,
      };
    });
  }, [offices, attendance]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-slate-500">Loading offices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Offices</h1>
        <p className="text-slate-500 mt-1">Overview of all office locations and their metrics</p>
      </div>

      {/* Office Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {officeStats.map((office) => (
          <div
            key={office.id}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow"
          >
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold">{office.name}</h3>
                  <div className="flex items-center gap-1 mt-1 text-blue-100">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{office.location}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{office.occupancyRate}%</p>
                  <p className="text-sm text-blue-100">utilization</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Current</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {office.currentOccupancy}/{office.capacity}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Daily Avg</p>
                    <p className="text-lg font-semibold text-slate-900">{office.avgDaily}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Clock className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Avg Stay</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {formatDuration(office.avgDuration)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <Users className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Peak</p>
                    <p className="text-lg font-semibold text-slate-900">{office.peakOccupancy}</p>
                  </div>
                </div>
              </div>

              {/* Capacity bar */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-500">Capacity utilization</span>
                  <span className="font-medium text-slate-700">
                    {office.currentOccupancy} of {office.capacity}
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      office.occupancyRate > 80
                        ? 'bg-red-500'
                        : office.occupancyRate > 60
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(office.occupancyRate, 100)}%` }}
                  />
                </div>
              </div>

              {/* 30-day summary */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                  30-Day Summary
                </p>
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">
                    {office.totalVisitors.toLocaleString()}
                  </span>{' '}
                  total visitors with an average stay of{' '}
                  <span className="font-semibold text-slate-900">
                    {formatDuration(office.avgDuration)}
                  </span>
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">All Offices Comparison</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Office
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Capacity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Current
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Daily Avg
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Utilization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Timezone
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {officeStats.map((office) => (
                <tr key={office.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {office.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {office.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {office.capacity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {office.currentOccupancy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {office.avgDaily}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            office.occupancyRate > 80
                              ? 'bg-red-500'
                              : office.occupancyRate > 60
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(office.occupancyRate, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-slate-600">{office.occupancyRate}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {office.timezone}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
