import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import type { AuthenticatedUser, UserRole } from '@/types';
import { loginRequest, graphConfig, roleMapping } from '@/config/msal';

interface AuthContextType {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  login: () => Promise<void>;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
  canViewUserDetails: boolean;
  canViewAllOffices: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER: AuthenticatedUser = {
  id: 'demo-user',
  email: 'demo@company.com',
  displayName: 'Demo Executive',
  department: 'Executive',
  jobTitle: 'CEO',
  role: 'executive',
  securityGroups: ['Office-Dashboard-Executives'],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true' ||
    !import.meta.env.VITE_AZURE_CLIENT_ID ||
    import.meta.env.VITE_AZURE_CLIENT_ID === 'YOUR_CLIENT_ID';

  const fetchUserProfile = useCallback(async () => {
    if (isDemoMode) {
      setUser(DEMO_USER);
      setIsLoading(false);
      return;
    }

    if (!isAuthenticated || accounts.length === 0) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });

      const [profileResponse, groupsResponse] = await Promise.all([
        fetch(graphConfig.graphMeEndpoint, {
          headers: { Authorization: `Bearer ${response.accessToken}` },
        }),
        fetch(graphConfig.graphMemberOfEndpoint, {
          headers: { Authorization: `Bearer ${response.accessToken}` },
        }),
      ]);

      const profile = await profileResponse.json();
      const groups = await groupsResponse.json();

      const securityGroups = groups.value
        ?.filter((g: { '@odata.type': string }) => g['@odata.type'] === '#microsoft.graph.group')
        .map((g: { displayName: string }) => g.displayName) || [];

      let role: UserRole = 'viewer';
      for (const [groupName, mappedRole] of Object.entries(roleMapping)) {
        if (securityGroups.includes(groupName)) {
          if (mappedRole === 'executive' || (mappedRole === 'manager' && role !== 'executive')) {
            role = mappedRole;
          }
        }
      }

      setUser({
        id: profile.id,
        email: profile.mail || profile.userPrincipalName,
        displayName: profile.displayName,
        department: profile.department,
        jobTitle: profile.jobTitle,
        photoUrl: undefined,
        role,
        securityGroups,
      });
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [instance, accounts, isAuthenticated, isDemoMode]);

  useEffect(() => {
    if (inProgress === InteractionStatus.None) {
      fetchUserProfile();
    }
  }, [inProgress, fetchUserProfile]);

  const login = async () => {
    if (isDemoMode) {
      setUser(DEMO_USER);
      return;
    }
    await instance.loginRedirect(loginRequest);
  };

  const logout = () => {
    if (isDemoMode) {
      setUser(null);
      return;
    }
    instance.logoutRedirect();
  };

  const hasRole = (role: UserRole): boolean => {
    if (!user) return false;
    const roleHierarchy: UserRole[] = ['viewer', 'manager', 'executive'];
    const userRoleIndex = roleHierarchy.indexOf(user.role);
    const requiredRoleIndex = roleHierarchy.indexOf(role);
    return userRoleIndex >= requiredRoleIndex;
  };

  const canViewUserDetails = user?.role === 'executive' || user?.role === 'manager';
  const canViewAllOffices = user?.role === 'executive';

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: isLoading || inProgress !== InteractionStatus.None,
        isAuthenticated: isDemoMode ? !!user : isAuthenticated,
        isDemoMode,
        login,
        logout,
        hasRole,
        canViewUserDetails,
        canViewAllOffices,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
