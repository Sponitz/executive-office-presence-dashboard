import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, Building2, Briefcase, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API_BASE_URL = 'https://improving-pulse-functions.azurewebsites.net/api';

interface User {
  id: string;
  entra_id: string;
  email: string;
  display_name: string;
  department: string | null;
  job_title: string | null;
  created_at: string;
}

interface UsersResponse {
  users: User[];
  total: number;
  limit: number;
  offset: number;
}

export function People() {
  const navigate = useNavigate();
  const { canViewUserDetails } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const limit = 50;
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    async function fetchUsers() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: (page * limit).toString(),
        });
        if (debouncedSearch) {
          params.set('search', debouncedSearch);
        }
        const response = await fetch(`${API_BASE_URL}/users?${params}`);
        const data: UsersResponse = await response.json();
        setUsers(data.users);
        setTotal(data.total);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, [page, debouncedSearch]);

  const totalPages = Math.ceil(total / limit);

  const handleExport = () => {
    const headers = ['Name', 'Email', 'Department', 'Job Title'];
    const rows = users.map((u) => [
      u.display_name,
      u.email,
      u.department || '',
      u.job_title || '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'improving-employees.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="text-slate-500 mt-1">{total.toLocaleString()} tracked employees from Entra ID</p>
        </div>
      </div>

      {/* Search and Export */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or department..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {canViewUserDetails && (
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-[#005596] text-white rounded-lg text-sm font-medium hover:bg-[#004477] transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4">Loading employees...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No employees found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Job Title
                    </th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/people/${user.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-[#005596]/10 flex items-center justify-center">
                            <span className="text-[#005596] font-medium">
                              {canViewUserDetails ? user.display_name?.charAt(0) || '?' : '#'}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">
                              {canViewUserDetails ? user.display_name : `Employee ${user.id.slice(-4)}`}
                            </div>
                            {canViewUserDetails && (
                              <div className="text-sm text-slate-500">{user.email}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Building2 className="h-4 w-4 text-slate-400" />
                          {user.department || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Briefcase className="h-4 w-4 text-slate-400" />
                          {user.job_title || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <ChevronRight className="h-5 w-5 text-slate-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total.toLocaleString()}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 text-sm border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 text-sm border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
