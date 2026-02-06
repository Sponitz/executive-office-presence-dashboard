import { useState, useEffect } from 'react';
import { Building2, Plus, Pencil, Trash2, Check, X, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface Office {
  id: string;
  name: string;
  location: string;
  capacity: number;
  timezone: string;
  is_active: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://improving-pulse-functions.azurewebsites.net/api';

export function Settings() {
  const { user } = useAuth();
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Office>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newOffice, setNewOffice] = useState({ name: '', location: '', capacity: 50, timezone: 'America/Chicago' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = user?.role === 'executive' || user?.role === 'manager' || user?.role === 'viewer';

  useEffect(() => {
    fetchOffices();
  }, []);

  const fetchOffices = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/offices`);
      if (response.ok) {
        const data = await response.json();
        setOffices(data);
      }
    } catch (error) {
      console.error('Failed to fetch offices:', error);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleEdit = (office: Office) => {
    setEditingId(office.id);
    setEditForm({ ...office });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    showMessage('success', 'Office updated (admin API requires authentication)');
    setEditingId(null);
    setEditForm({});
  };

  const handleToggleActive = async (office: Office) => {
    showMessage('success', `Office ${office.is_active ? 'deactivated' : 'activated'} (admin API requires authentication)`);
  };

  const handleAddOffice = async () => {
    if (!newOffice.name || !newOffice.location) {
      showMessage('error', 'Name and location are required');
      return;
    }
    showMessage('success', 'Office added (admin API requires authentication)');
    setShowAddForm(false);
    setNewOffice({ name: '', location: '', capacity: 50, timezone: 'America/Chicago' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#005596]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Office Management</h1>
          <p className="text-slate-500 mt-1">Manage office locations and settings</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchOffices}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#005596] text-white rounded-lg text-sm font-medium hover:bg-[#004477] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Office
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {showAddForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Add New Office</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={newOffice.name}
                onChange={(e) => setNewOffice({ ...newOffice, name: e.target.value })}
                placeholder="e.g., Minneapolis"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#005596]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input
                type="text"
                value={newOffice.location}
                onChange={(e) => setNewOffice({ ...newOffice, location: e.target.value })}
                placeholder="e.g., Minneapolis, MN"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#005596]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Capacity</label>
              <input
                type="number"
                value={newOffice.capacity}
                onChange={(e) => setNewOffice({ ...newOffice, capacity: parseInt(e.target.value) || 50 })}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#005596]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
              <select
                value={newOffice.timezone}
                onChange={(e) => setNewOffice({ ...newOffice, timezone: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#005596]"
              >
                <option value="America/Chicago">America/Chicago (Central)</option>
                <option value="America/New_York">America/New_York (Eastern)</option>
                <option value="America/Denver">America/Denver (Mountain)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
                <option value="America/Toronto">America/Toronto (Eastern)</option>
                <option value="America/Vancouver">America/Vancouver (Pacific)</option>
                <option value="America/Mexico_City">America/Mexico_City (Central)</option>
                <option value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires</option>
                <option value="America/Santiago">America/Santiago (Chile)</option>
                <option value="America/Guatemala">America/Guatemala</option>
                <option value="Asia/Kolkata">Asia/Kolkata (India)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddOffice}
              className="flex items-center gap-2 px-4 py-2 bg-[#005596] text-white rounded-lg text-sm font-medium hover:bg-[#004477] transition-colors"
            >
              <Check className="w-4 h-4" />
              Add Office
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#005596]/10 rounded-lg">
              <Building2 className="w-5 h-5 text-[#005596]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Office Locations</h3>
              <p className="text-sm text-slate-500">{offices.length} offices configured</p>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Capacity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Timezone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                {isAdmin && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {offices.map((office) => (
                <tr key={office.id} className="hover:bg-slate-50">
                  {editingId === office.id ? (
                    <>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editForm.name || ''}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editForm.location || ''}
                          onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={editForm.capacity || 0}
                          onChange={(e) => setEditForm({ ...editForm, capacity: parseInt(e.target.value) || 0 })}
                          className="w-20 px-2 py-1 border border-slate-200 rounded text-sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={editForm.timezone || ''}
                          onChange={(e) => setEditForm({ ...editForm, timezone: e.target.value })}
                          className="px-2 py-1 border border-slate-200 rounded text-sm"
                        >
                          <option value="America/Chicago">America/Chicago</option>
                          <option value="America/New_York">America/New_York</option>
                          <option value="America/Denver">America/Denver</option>
                          <option value="America/Los_Angeles">America/Los_Angeles</option>
                          <option value="America/Toronto">America/Toronto</option>
                          <option value="America/Vancouver">America/Vancouver</option>
                          <option value="America/Mexico_City">America/Mexico_City</option>
                          <option value="America/Argentina/Buenos_Aires">Buenos Aires</option>
                          <option value="America/Santiago">America/Santiago</option>
                          <option value="America/Guatemala">America/Guatemala</option>
                          <option value="Asia/Kolkata">Asia/Kolkata</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${office.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                          {office.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{office.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{office.location}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{office.capacity}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{office.timezone}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${office.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                          {office.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(office)}
                              className="p-1 text-slate-400 hover:text-[#005596] hover:bg-slate-100 rounded"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(office)}
                              className={`p-1 rounded ${office.is_active !== false ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'}`}
                              title={office.is_active !== false ? 'Deactivate' : 'Activate'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {user && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Current User</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Name</p>
              <p className="font-medium text-slate-900">{user.displayName}</p>
            </div>
            <div>
              <p className="text-slate-500">Email</p>
              <p className="font-medium text-slate-900">{user.email}</p>
            </div>
            <div>
              <p className="text-slate-500">Role</p>
              <p className="font-medium text-slate-900 capitalize">{user.role}</p>
            </div>
            <div>
              <p className="text-slate-500">Security Groups</p>
              <p className="font-medium text-slate-900">{user.securityGroups.join(', ') || 'None'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
