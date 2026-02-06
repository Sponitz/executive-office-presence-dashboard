import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Building2, Briefcase, Calendar, MapPin, Clock, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API_BASE_URL = 'https://improving-pulse-functions.azurewebsites.net/api';

interface UserProfile {
  id: string;
  entra_id: string;
  email: string;
  display_name: string;
  department: string | null;
  job_title: string | null;
  office_location: string | null;
  manager_name: string | null;
  manager_email: string | null;
  employee_type: string | null;
  account_enabled: boolean;
  created_at: string;
}

interface PresenceSession {
  id: string;
  office_name: string;
  entry_time: string;
  exit_time: string | null;
  duration_minutes: number | null;
}

interface UserStats {
  total_visits: number;
  total_hours: number;
  avg_duration_minutes: number;
  most_visited_office: string | null;
  last_visit: string | null;
}

export function UserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { canViewUserDetails } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<PresenceSession[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserData() {
      if (!userId) return;
      setLoading(true);
      setError(null);
      try {
        const [userRes, sessionsRes, statsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/user/${userId}`),
          fetch(`${API_BASE_URL}/user/${userId}/sessions?limit=20`),
          fetch(`${API_BASE_URL}/user/${userId}/stats`),
        ]);

        if (!userRes.ok) {
          throw new Error('User not found');
        }

        const userData = await userRes.json();
        setUser(userData);

        if (sessionsRes.ok) {
          const sessionsData = await sessionsRes.json();
          setSessions(sessionsData.sessions || []);
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load user');
      } finally {
        setLoading(false);
      }
    }
    fetchUserData();
  }, [userId]);

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
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (!canViewUserDetails) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">You don't have permission to view user details.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-slate-500">Loading user profile...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">{error || 'User not found'}</p>
        <button
          onClick={() => navigate('/people')}
          className="mt-4 text-blue-600 hover:underline"
        >
          Back to Employees
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/people')}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Employees
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-[#005596] to-[#4597D3] flex items-center justify-center mb-4">
                <span className="text-3xl font-bold text-white">
                  {user.display_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">{user.display_name}</h1>
              <p className="text-slate-500">{user.job_title || 'No title'}</p>
              {user.department && (
                <span className="mt-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                  {user.department}
                </span>
              )}
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 text-slate-600">
                <Mail className="w-5 h-5 text-slate-400" />
                <a href={`mailto:${user.email}`} className="hover:text-blue-600">
                  {user.email}
                </a>
              </div>
              {user.office_location && (
                <div className="flex items-center gap-3 text-slate-600">
                  <MapPin className="w-5 h-5 text-slate-400" />
                  <span>{user.office_location}</span>
                </div>
              )}
              {user.manager_name && (
                <div className="flex items-center gap-3 text-slate-600">
                  <Users className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Reports to</p>
                    <p>{user.manager_name}</p>
                    {user.manager_email && (
                      <a href={`mailto:${user.manager_email}`} className="text-sm text-blue-600 hover:underline">
                        {user.manager_email}
                      </a>
                    )}
                  </div>
                </div>
              )}
              {user.employee_type && (
                <div className="flex items-center gap-3 text-slate-600">
                  <Briefcase className="w-5 h-5 text-slate-400" />
                  <span>{user.employee_type}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-slate-600">
                <Calendar className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Synced on</p>
                  <p>{formatDate(user.created_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {stats && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Attendance Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-700">{stats.total_visits}</p>
                  <p className="text-xs text-blue-600">Total Visits</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-700">{Math.round(stats.total_hours)}</p>
                  <p className="text-xs text-green-600">Total Hours</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-700">
                    {stats.avg_duration_minutes ? formatDuration(stats.avg_duration_minutes) : '-'}
                  </p>
                  <p className="text-xs text-purple-600">Avg Duration</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <p className="text-lg font-bold text-orange-700 truncate">
                    {stats.most_visited_office || '-'}
                  </p>
                  <p className="text-xs text-orange-600">Most Visited</p>
                </div>
              </div>
              {stats.last_visit && (
                <p className="mt-4 text-sm text-slate-500">
                  Last seen: {formatDate(stats.last_visit)}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Recent Office Visits</h3>
              <p className="text-sm text-slate-500">Last 20 visits across all offices</p>
            </div>
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p>No office visits recorded yet</p>
                <p className="text-sm mt-1">Visit history will appear here once access data is synced</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {sessions.map((session) => (
                  <div key={session.id} className="p-4 hover:bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{session.office_name}</p>
                          <p className="text-sm text-slate-500">{formatDate(session.entry_time)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-900">
                          {formatTime(session.entry_time)}
                          {session.exit_time && ` - ${formatTime(session.exit_time)}`}
                        </p>
                        {session.duration_minutes && (
                          <p className="text-sm text-slate-500">
                            {formatDuration(session.duration_minutes)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
