import { useState, useMemo } from 'react';
import { subDays } from 'date-fns';
import { Search, Download } from 'lucide-react';
import { OfficeSelector, DateRangePicker } from '@/components';
import { mockOffices, generateUserPresenceSummaries } from '@/utils/mockData';
import { useAuth } from '@/context/AuthContext';

export function People() {
  const { canViewUserDetails } = useAuth();
  const [selectedOfficeIds, setSelectedOfficeIds] = useState<string[]>(
    mockOffices.map((o) => o.id)
  );
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 29),
    end: new Date(),
  });
  const [search, setSearch] = useState('');

  const userPresence = useMemo(() => generateUserPresenceSummaries(), []);

  const filteredUsers = useMemo(() => {
    return userPresence.filter((u) => {
      const matchesSearch =
        u.user.displayName.toLowerCase().includes(search.toLowerCase()) ||
        u.user.email.toLowerCase().includes(search.toLowerCase()) ||
        u.user.department?.toLowerCase().includes(search.toLowerCase());

      const matchesOffice =
        selectedOfficeIds.length === 0 ||
        (u.primaryOffice &&
          mockOffices.some(
            (o) => selectedOfficeIds.includes(o.id) && o.name === u.primaryOffice
          ));

      return matchesSearch && matchesOffice;
    });
  }, [userPresence, search, selectedOfficeIds]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const handleExport = () => {
    const headers = ['Name', 'Email', 'Department', 'Total Visits', 'Total Time', 'Avg Stay', 'Last Visit', 'Primary Office'];
    const rows = filteredUsers.map((u) => [
      u.user.displayName,
      u.user.email,
      u.user.department || '',
      u.totalVisits.toString(),
      formatDuration(u.totalMinutes),
      formatDuration(u.averageMinutesPerVisit),
      formatDate(u.lastVisit),
      u.primaryOffice || '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'office-presence-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">People</h1>
          <p className="text-slate-500 mt-1">View individual presence data and patterns</p>
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

      {/* Search and Export */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {canViewUserDetails && (
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-sm text-slate-500">
        Showing {filteredUsers.length} of {userPresence.length} people
      </p>

      {/* People Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((person) => (
          <div
            key={person.userId}
            className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-lg font-semibold">
                {canViewUserDetails ? person.user.displayName.charAt(0) : '#'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-slate-900 truncate">
                  {canViewUserDetails ? person.user.displayName : `Employee ${person.userId.slice(-4)}`}
                </h3>
                {canViewUserDetails && (
                  <>
                    <p className="text-sm text-slate-500 truncate">{person.user.email}</p>
                    <p className="text-sm text-slate-400">{person.user.department}</p>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Total Visits</p>
                <p className="text-xl font-bold text-slate-900">{person.totalVisits}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Total Time</p>
                <p className="text-xl font-bold text-slate-900">{formatDuration(person.totalMinutes)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Avg Stay</p>
                <p className="text-sm font-medium text-slate-700">
                  {formatDuration(person.averageMinutesPerVisit)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Last Visit</p>
                <p className="text-sm font-medium text-slate-700">{formatDate(person.lastVisit)}</p>
              </div>
            </div>

            {canViewUserDetails && person.primaryOffice && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500">Primary Office</p>
                <p className="text-sm font-medium text-slate-700">{person.primaryOffice}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500">No people found matching your criteria</p>
        </div>
      )}
    </div>
  );
}
