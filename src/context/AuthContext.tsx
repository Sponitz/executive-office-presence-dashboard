import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import type { AuthenticatedUser, UserRole } from '@/types';
import { loginRequest, graphConfig, groupIds } from '@/config/msal';

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

  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

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

      const profileResponse = await fetch(graphConfig.graphMeEndpoint, {
        headers: { Authorization: `Bearer ${response.accessToken}` },
      });
      const profile = await profileResponse.json();

      // Paginate through all groups (Graph API returns max 100 per page)
      interface GraphGroup {
        id: string;
        displayName: string;
        '@odata.type': string;
      }
      interface GraphMemberOfResponse {
        value?: GraphGroup[];
        '@odata.nextLink'?: string;
      }
      
      let allGroups: GraphGroup[] = [];
      let nextLink: string | null = graphConfig.graphMemberOfEndpoint;
      
      while (nextLink) {
        const groupsRes = await fetch(nextLink, {
          headers: { Authorization: `Bearer ${response.accessToken}` },
        });
        const groupsData: GraphMemberOfResponse = await groupsRes.json();
        
        if (groupsData.value) {
          allGroups = [...allGroups, ...groupsData.value];
        }
        
        nextLink = groupsData['@odata.nextLink'] || null;
      }

      console.log('Total groups fetched:', allGroups.length);
      console.log('Expected executive group ID:', groupIds.executives);

      const securityGroupIds = allGroups
        .filter((g) => g['@odata.type'] === '#microsoft.graph.group')
        .map((g) => g.id);

      const securityGroups = allGroups
        .filter((g) => g['@odata.type'] === '#microsoft.graph.group')
        .map((g) => g.displayName);

      console.log('User security group IDs:', securityGroupIds);
      console.log('User security group names:', securityGroups);

      let role: UserRole = 'viewer';
      if (securityGroupIds.includes(groupIds.executives)) {
        role = 'executive';
        console.log('Matched executive group');
      } else if (securityGroupIds.includes(groupIds.managers)) {
        role = 'manager';
        console.log('Matched manager group');
      } else if (securityGroupIds.includes(groupIds.viewers)) {
        role = 'viewer';
        console.log('Matched viewer group');
      } else {
        console.log('No matching group found, defaulting to viewer');
      }
      console.log('Assigned role:', role);

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
