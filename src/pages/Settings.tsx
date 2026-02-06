import { useState } from 'react';
import { Save, Key, Database, Bell, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function Settings() {
  const { user, isDemoMode } = useAuth();
  const [saved, setSaved] = useState(false);

  const [settings, setSettings] = useState({
    azureClientId: '',
    azureTenantId: '',
    apiBaseUrl: '',
    ezradiusApiKey: '',
    unifiAccessUrl: '',
    unifiAccessToken: '',
    refreshInterval: '5',
    enableNotifications: true,
    dataRetentionDays: '90',
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Configure your dashboard and integrations</p>
      </div>

      {isDemoMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            <strong>Demo Mode Active:</strong> The dashboard is running with mock data. Configure the
            settings below and restart the application to connect to real data sources.
          </p>
        </div>
      )}

      {/* Azure AD Configuration */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#005596]/10 rounded-lg">
              <Shield className="w-5 h-5 text-[#005596]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Azure AD Configuration</h3>
              <p className="text-sm text-slate-500">Configure Entra ID authentication</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Client ID (Application ID)
            </label>
            <input
              type="text"
              value={settings.azureClientId}
              onChange={(e) => setSettings({ ...settings, azureClientId: e.target.value })}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tenant ID (Directory ID)
            </label>
            <input
              type="text"
              value={settings.azureTenantId}
              onChange={(e) => setSettings({ ...settings, azureTenantId: e.target.value })}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-slate-600">
              <strong>Setup Instructions:</strong>
            </p>
            <ol className="text-sm text-slate-600 mt-2 space-y-1 list-decimal list-inside">
              <li>Go to Azure Portal → Entra ID → App registrations</li>
              <li>Create a new registration or select existing</li>
              <li>Add redirect URI: <code className="bg-slate-200 px-1 rounded">{window.location.origin}</code></li>
              <li>Enable ID tokens under Authentication</li>
              <li>Add API permissions: User.Read, GroupMember.Read.All</li>
            </ol>
          </div>
        </div>
      </div>

      {/* API Configuration */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#5BC2A7]/20 rounded-lg">
              <Key className="w-5 h-5 text-[#5BC2A7]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">API Integrations</h3>
              <p className="text-sm text-slate-500">Connect to EZRADIUS and UniFi Access</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              EZRADIUS API Key
            </label>
            <input
              type="password"
              value={settings.ezradiusApiKey}
              onChange={(e) => setSettings({ ...settings, ezradiusApiKey: e.target.value })}
              placeholder="Enter your EZRADIUS API key"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              UniFi Access Controller URL
            </label>
            <input
              type="url"
              value={settings.unifiAccessUrl}
              onChange={(e) => setSettings({ ...settings, unifiAccessUrl: e.target.value })}
              placeholder="https://unifi.example.com:12445"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              UniFi Access API Token
            </label>
            <input
              type="password"
              value={settings.unifiAccessToken}
              onChange={(e) => setSettings({ ...settings, unifiAccessToken: e.target.value })}
              placeholder="Enter your UniFi Access API token"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Database Configuration */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#9D1D96]/10 rounded-lg">
              <Database className="w-5 h-5 text-[#9D1D96]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Database Settings</h3>
              <p className="text-sm text-slate-500">Configure data storage and retention</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              API Base URL
            </label>
            <input
              type="url"
              value={settings.apiBaseUrl}
              onChange={(e) => setSettings({ ...settings, apiBaseUrl: e.target.value })}
              placeholder="https://your-azure-function.azurewebsites.net/api"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Data Refresh Interval (minutes)
            </label>
            <select
              value={settings.refreshInterval}
              onChange={(e) => setSettings({ ...settings, refreshInterval: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1">1 minute</option>
              <option value="5">5 minutes</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Data Retention (days)
            </label>
            <input
              type="number"
              value={settings.dataRetentionDays}
              onChange={(e) => setSettings({ ...settings, dataRetentionDays: e.target.value })}
              min="30"
              max="365"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F5BB41]/20 rounded-lg">
              <Bell className="w-5 h-5 text-[#F5BB41]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Notifications</h3>
              <p className="text-sm text-slate-500">Configure alerts and notifications</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enableNotifications}
              onChange={(e) => setSettings({ ...settings, enableNotifications: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">
              Enable capacity threshold notifications
            </span>
          </label>
        </div>
      </div>

      {/* User Info */}
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

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2 bg-[#005596] text-white rounded-lg text-sm font-medium hover:bg-[#004477] transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">Settings saved successfully!</span>
        )}
      </div>
    </div>
  );
}
