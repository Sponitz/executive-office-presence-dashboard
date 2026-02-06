import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Users, Clock, TrendingUp, Calendar } from 'lucide-react';

const API_BASE_URL = 'https://improving-pulse-functions.azurewebsites.net/api';

interface Office {
  id: string;
  name: string;
  location: string;
  capacity: number;
  timezone: string;
  is_active: boolean;
}

interface DailyStats {
  date: string;
  unique_visitors: number;
  total_entries: number;
  avg_duration_minutes: number;
  peak_occupancy: number;
}

interface HourlyStats {
  hour: number;
  avg_occupancy: number;
}

interface TopVisitor {
  user_id: string;
  display_name: string;
  email: string;
  visit_count: number;
  total_hours: number;
}

export function OfficeDetail() {
  const { officeId } = useParams<{ officeId: string }>();
  const navigate = useNavigate();
  const [office, setOffice] = useState<Office | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([]);
  const [topVisitors, setTopVisitors] = useState<TopVisitor[]>([]);
  const [currentOccupancy, setCurrentOccupancy] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOfficeData() {
      if (!officeId) return;
      setLoading(true);
      setError(null);
      try {
        const [officeRes, dailyRes, hourlyRes, visitorsRes, occupancyRes] = await Promise.all([
          fetch(`${API_BASE_URL}/office/${officeId}`),
          fetch(`${API_BASE_URL}/office/${officeId}/daily?days=30`),
          fetch(`${API_BASE_URL}/office/${officeId}/hourly`),
          fetch(`${API_BASE_URL}/office/${officeId}/top-visitors?limit=10`),
          fetch(`${API_BASE_URL}/office/${officeId}/occupancy`),
        ]);

        if (!officeRes.ok) {
          throw new Error('Office not found');
        }

        const officeData = await officeRes.json();
        setOffice(officeData);

        if (dailyRes.ok) {
          const data = await dailyRes.json();
          setDailyStats(data.stats || []);
        }

        if (hourlyRes.ok) {
          const data = await hourlyRes.json();
          setHourlyStats(data.stats || []);
        }

        if (visitorsRes.ok) {
          const data = await visitorsRes.json();
          setTopVisitors(data.visitors || []);
        }

        if (occupancyRes.ok) {
          const data = await occupancyRes.json();
          setCurrentOccupancy(data.current || 0);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load office');
      } finally {
        setLoading(false);
      }
    }
    fetchOfficeData();
  }, [officeId]);

  const summaryStats = useMemo(() => {
    if (dailyStats.length === 0) return null;
    const totalVisitors = dailyStats.reduce((sum, d) => sum + d.unique_visitors, 0);
    const avgDaily = Math.round(totalVisitors / dailyStats.length);
    const avgDuration = Math.round(
      dailyStats.reduce((sum, d) => sum + d.avg_duration_minutes, 0) / dailyStats.length
    );
    const peakOccupancy = Math.max(...dailyStats.map(d => d.peak_occupancy));
    return { totalVisitors, avgDaily, avgDuration, peakOccupancy };
  }, [dailyStats]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getHourLabel = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-slate-500">Loading office details...</p>
      </div>
    );
  }

  if (error || !office) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">{error || 'Office not found'}</p>
        <button
          onClick={() => navigate('/offices')}
          className="mt-4 text-blue-600 hover:underline"
        >
          Back to Offices
        </button>
      </div>
    );
  }

  const occupancyRate = office.capacity > 0 ? Math.round((currentOccupancy / office.capacity) * 100) : 0;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/offices')}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Offices
      </button>

      <div className="bg-gradient-to-r from-[#005596] to-[#4597D3] rounded-xl p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{office.name}</h1>
            <div className="flex items-center gap-2 mt-2 text-blue-100">
              <MapPin className="w-4 h-4" />
              <span>{office.location}</span>
            </div>
            <p className="text-sm text-blue-100 mt-1">Timezone: {office.timezone}</p>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-4xl font-bold">{currentOccupancy}</p>
              <p className="text-sm text-blue-100">Current</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold">{office.capacity}</p>
              <p className="text-sm text-blue-100">Capacity</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold">{occupancyRate}%</p>
              <p className="text-sm text-blue-100">Utilization</p>
            </div>
          </div>
        </div>
      </div>

      {summaryStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{summaryStats.totalVisitors.toLocaleString()}</p>
                <p className="text-xs text-slate-500">Total Visitors (30d)</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{summaryStats.avgDaily}</p>
                <p className="text-xs text-slate-500">Daily Average</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{formatDuration(summaryStats.avgDuration)}</p>
                <p className="text-xs text-slate-500">Avg Stay Duration</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-50 rounded-lg">
                <Users className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{summaryStats.peakOccupancy}</p>
                <p className="text-xs text-slate-500">Peak Occupancy</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Peak Hours</h3>
            <p className="text-sm text-slate-500">Average occupancy by hour of day</p>
          </div>
          <div className="p-6">
            {hourlyStats.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p>No hourly data available yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {hourlyStats.filter(h => h.hour >= 6 && h.hour <= 20).map((stat) => {
                  const maxOccupancy = Math.max(...hourlyStats.map(h => h.avg_occupancy));
                  const percentage = maxOccupancy > 0 ? (stat.avg_occupancy / maxOccupancy) * 100 : 0;
                  return (
                    <div key={stat.hour} className="flex items-center gap-3">
                      <span className="w-16 text-sm text-slate-500">{getHourLabel(stat.hour)}</span>
                      <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#005596] to-[#4597D3] rounded"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-8 text-sm text-slate-600 text-right">{Math.round(stat.avg_occupancy)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Top Visitors</h3>
            <p className="text-sm text-slate-500">Most frequent visitors this month</p>
          </div>
          {topVisitors.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p>No visitor data available yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {topVisitors.map((visitor, index) => (
                <div
                  key={visitor.user_id}
                  className="p-4 hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/people/${visitor.user_id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#005596]/10 flex items-center justify-center">
                        <span className="text-[#005596] font-medium">
                          {index + 1}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{visitor.display_name}</p>
                        <p className="text-sm text-slate-500">{visitor.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{visitor.visit_count} visits</p>
                      <p className="text-sm text-slate-500">{Math.round(visitor.total_hours)}h total</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Daily Attendance</h3>
          <p className="text-sm text-slate-500">Last 30 days</p>
        </div>
        {dailyStats.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p>No daily attendance data available yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Visitors</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Entries</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Avg Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Peak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {dailyStats.slice(0, 14).map((stat) => (
                  <tr key={stat.date} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-900">{formatDate(stat.date)}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">{stat.unique_visitors}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">{stat.total_entries}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">{formatDuration(stat.avg_duration_minutes)}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">{stat.peak_occupancy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
