import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { msalConfig } from '@/config/msal';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Layout } from '@/components';
import { Dashboard, Attendance, People, UserDetail, Offices, OfficeDetail, Settings, Login } from '@/pages';

const msalInstance = new PublicClientApplication(msalConfig);

msalInstance.initialize().then(() => {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0]);
  }

  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const payload = event.payload as { account: { username: string } };
      const account = payload.account;
      msalInstance.setActiveAccount(account as ReturnType<typeof msalInstance.getActiveAccount>);
    }
  });
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function ManagerRoute({ children }: { children: React.ReactNode }) {
  const { hasRole } = useAuth();

  if (!hasRole('manager')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance"
        element={
          <ProtectedRoute>
            <Attendance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/people"
        element={
          <ProtectedRoute>
            <ManagerRoute>
              <People />
            </ManagerRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/people/:userId"
        element={
          <ProtectedRoute>
            <ManagerRoute>
              <UserDetail />
            </ManagerRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/offices"
        element={
          <ProtectedRoute>
            <Offices />
          </ProtectedRoute>
        }
      />
      <Route
        path="/offices/:officeId"
        element={
          <ProtectedRoute>
            <OfficeDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </MsalProvider>
  );
}
