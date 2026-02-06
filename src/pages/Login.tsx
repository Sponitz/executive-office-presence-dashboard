import { Building2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function Login() {
  const { login, isDemoMode } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-6">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Office Presence Dashboard</h1>
          <p className="text-slate-500 mt-2">
            Monitor office attendance and presence trends across your organization
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
              <path d="M10 0H0V10H10V0Z" fill="#F25022" />
              <path d="M21 0H11V10H21V0Z" fill="#7FBA00" />
              <path d="M10 11H0V21H10V11Z" fill="#00A4EF" />
              <path d="M21 11H11V21H21V11Z" fill="#FFB900" />
            </svg>
            {isDemoMode ? 'Continue with Demo Mode' : 'Sign in with Microsoft'}
          </button>

          {isDemoMode && (
            <p className="text-center text-sm text-slate-500">
              Demo mode is active. You'll see sample data.
            </p>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200">
          <h3 className="text-sm font-medium text-slate-900 mb-3">Features</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
              Real-time office occupancy tracking
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
              Historical attendance trends
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
              Peak hours analysis
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
              Multi-office comparison
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
