import { Configuration, LogLevel } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || 'ac274c9a-9a88-470f-8518-23f740bb0e26',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || 'f2267c2e-5a54-49f4-84fa-e4f2f4038a2e'}`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            break;
          case LogLevel.Warning:
            console.warn(message);
            break;
          case LogLevel.Info:
            console.info(message);
            break;
          case LogLevel.Verbose:
            console.debug(message);
            break;
        }
      },
      logLevel: LogLevel.Warning,
    },
  },
};

export const loginRequest = {
  scopes: ['User.Read', 'GroupMember.Read.All'],
};

export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
  graphMemberOfEndpoint: 'https://graph.microsoft.com/v1.0/me/memberOf',
};

export const roleMapping: Record<string, 'executive' | 'manager' | 'viewer'> = {
  'Pulse-Executives': 'executive',
  'Pulse-Managers': 'manager',
  'Pulse-Viewers': 'viewer',
};

export const groupIds = {
  executives: '0436b5a2-7512-45bb-b9b5-030f4619564c',
  managers: '45abd4d9-ec6e-43be-baeb-3e4680997405',
  viewers: 'a76abcda-98c3-4607-8d4c-08bae451803b',
  trackedUsers: '43bc7a18-9b24-482f-9a79-c3af78621f41',
};
