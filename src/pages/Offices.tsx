import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Users, Clock, TrendingUp, Loader2 } from 'lucide-react';

interface Office {
  id: string;
  name: string;
  location: string;
  capacity: number;
  timezone: string;
  is_active: boolean;
}

const API_BASE = 'https://improving-pulse-functions.azurewebsites.net/api';

export function Offices() {
  const navigate = useNavigate();
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOffices() {
      try {
        const response = await fetch(`${API_BASE}/offices`);
        if (response.ok) {
          const data = await response.json();
          setOffices(data);
        }
      } catch (error) {
        console.error('Failed to fetch offices:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchOffices();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#005596]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Offices</h1>
        <p className="text-slate-500 mt-1">Overview of all office locations and their metrics</p>
      </div>

      {/* Office Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {offices.map((office) => (
          <div
            key={office.id}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate(`/offices/${office.id}`)}
          >
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-[#005596] to-[#4597D3] p-6 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold">{office.name}</h3>
                  <div className="flex items-center gap-1 mt-1 text-blue-100">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{office.location}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{office.capacity}</p>
                  <p className="text-sm text-blue-100">capacity</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Users className="w-5 h-5 text-[#005596]" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Capacity</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {office.capacity}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-[#5BC2A7]" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Status</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {office.is_active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 col-span-2">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Clock className="w-5 h-5 text-[#9D1D96]" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Timezone</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {office.timezone}
                    </p>
                  </div>
                </div>
              </div>

              {/* Click to view details */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-sm text-[#005596] font-medium">
                  Click to view office details →
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">All Offices</h3>
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
                  Timezone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {offices.map((office) => (
                <tr
                  key={office.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/offices/${office.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {office.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {office.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {office.capacity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {office.timezone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      office.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {office.is_active ? 'Active' : 'Inactive'}
                    </span>
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
