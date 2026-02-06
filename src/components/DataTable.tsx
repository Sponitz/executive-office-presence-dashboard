import { useState } from 'react';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';
import type { UserPresenceSummary } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface DataTableProps {
  data: UserPresenceSummary[];
  title: string;
}

type SortField = 'displayName' | 'totalVisits' | 'totalMinutes' | 'lastVisit';
type SortDirection = 'asc' | 'desc';

export function DataTable({ data, title }: DataTableProps) {
  const { canViewUserDetails } = useAuth();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('totalVisits');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredData = data.filter((item) =>
    item.user.displayName.toLowerCase().includes(search.toLowerCase()) ||
    item.user.department?.toLowerCase().includes(search.toLowerCase())
  );

  const sortedData = [...filteredData].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'displayName':
        comparison = a.user.displayName.localeCompare(b.user.displayName);
        break;
      case 'totalVisits':
        comparison = a.totalVisits - b.totalVisits;
        break;
      case 'totalMinutes':
        comparison = a.totalMinutes - b.totalMinutes;
        break;
      case 'lastVisit':
        comparison = (a.lastVisit?.getTime() || 0) - (b.lastVisit?.getTime() || 0);
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

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
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="p-6 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 w-full sm:w-64 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort('displayName')}
              >
                <div className="flex items-center gap-1">
                  {canViewUserDetails ? 'Name' : 'Employee'}
                  <SortIcon field="displayName" />
                </div>
              </th>
              {canViewUserDetails && (
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Department
                </th>
              )}
              <th
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort('totalVisits')}
              >
                <div className="flex items-center gap-1">
                  Visits
                  <SortIcon field="totalVisits" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort('totalMinutes')}
              >
                <div className="flex items-center gap-1">
                  Total Time
                  <SortIcon field="totalMinutes" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Avg. Stay
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort('lastVisit')}
              >
                <div className="flex items-center gap-1">
                  Last Visit
                  <SortIcon field="lastVisit" />
                </div>
              </th>
              {canViewUserDetails && (
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Primary Office
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sortedData.slice(0, 10).map((item) => (
              <tr key={item.userId} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">
                      {canViewUserDetails
                        ? item.user.displayName.charAt(0)
                        : '#'}
                    </div>
                    <span className="text-sm font-medium text-slate-900">
                      {canViewUserDetails ? item.user.displayName : `Employee ${item.userId.slice(-4)}`}
                    </span>
                  </div>
                </td>
                {canViewUserDetails && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {item.user.department || 'N/A'}
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                  {item.totalVisits}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                  {formatDuration(item.totalMinutes)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {formatDuration(item.averageMinutesPerVisit)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {formatDate(item.lastVisit)}
                </td>
                {canViewUserDetails && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {item.primaryOffice || 'N/A'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedData.length === 0 && (
        <div className="p-8 text-center text-slate-500">
          No results found for "{search}"
        </div>
      )}

      {sortedData.length > 10 && (
        <div className="p-4 border-t border-slate-200 text-center">
          <span className="text-sm text-slate-500">
            Showing 10 of {sortedData.length} results
          </span>
        </div>
      )}
    </div>
  );
}
