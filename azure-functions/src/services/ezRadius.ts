import { ClientSecretCredential } from '@azure/identity';

export interface EzRadiusAuthEvent {
  SubscriptionId?: string;
  RadiusSubscriptionTenantId?: string;
  PolicyID?: string;
  AccessPolicyId?: string;
  AccessPolicyName?: string;
  Successful: boolean;
  Message: string;
  UserName: string;
  CertificateThumbprint: string;
  Certificate: string;
  VLanName: string;
  FilterID: string;
  AuthenticationType: string;
  DateCreated: string;
  RequestingIP: string;
  RADIUSIP: string;
}

interface AuditRequestPayload {
  DateFrom: string;
  DateTo: string;
  MaxNumberOfRecords: number;
  PageNumber: number;
}

interface IpOfficeMapping {
  ip: string;
  officeSearchTerms: string[];
  description: string;
}

export const IP_OFFICE_MAP: IpOfficeMapping[] = [
  { ip: '4.18.214.218', officeSearchTerms: ['minneapolis'], description: 'Minneapolis - Lumen' },
  { ip: '209.66.126.50', officeSearchTerms: ['minneapolis'], description: 'Minneapolis - Zayo' },
  { ip: '24.51.52.250', officeSearchTerms: ['omaha'], description: 'Omaha' },
  { ip: '45.167.159.25', officeSearchTerms: ['aguascalientes'], description: 'Aguascalientes - BBSred' },
  { ip: '201.174.152.58', officeSearchTerms: ['aguascalientes'], description: 'Aguascalientes - Transtelco' },
  { ip: '47.190.32.118', officeSearchTerms: ['dallas'], description: 'Dallas - Frontier' },
  { ip: '162.234.81.89', officeSearchTerms: ['dallas'], description: 'Dallas - AT&T' },
  { ip: '50.222.187.218', officeSearchTerms: ['houston'], description: 'Houston - Comcast' },
  { ip: '139.94.145.226', officeSearchTerms: ['houston'], description: 'Houston - Ezee Fiber' },
  { ip: '64.65.57.10', officeSearchTerms: ['ottawa'], description: 'Ottawa' },
  { ip: '64.141.31.34', officeSearchTerms: ['calgary'], description: 'Calgary' },
  { ip: '76.9.195.26', officeSearchTerms: ['toronto'], description: 'Toronto' },
  { ip: '104.61.88.121', officeSearchTerms: ['atlanta'], description: 'Atlanta' },
  { ip: '107.134.28.241', officeSearchTerms: ['cleveland'], description: 'Cleveland' },
  { ip: '108.246.58.81', officeSearchTerms: ['columbus'], description: 'Columbus' },
  { ip: '184.71.174.134', officeSearchTerms: ['vancouver'], description: 'Vancouver' },
  { ip: '189.206.212.146', officeSearchTerms: ['guadalajara'], description: 'Guadalajara - Alestra' },
  { ip: '192.141.126.13', officeSearchTerms: ['guadalajara'], description: 'Guadalajara - Coeficiente' },
];

export function getOfficeSearchTermsForIp(ip: string): string[] | null {
  const mapping = IP_OFFICE_MAP.find(m => m.ip === ip);
  return mapping?.officeSearchTerms || null;
}

async function getEzRadiusToken(): Promise<string> {
  const tenantId = process.env.EZRADIUS_TENANT_ID || process.env.AZURE_TENANT_ID;
  const clientId = process.env.EZRADIUS_CLIENT_ID || process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.EZRADIUS_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Service principal credentials not configured. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET (or EZRADIUS_* equivalents)');
  }

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const scope = process.env.EZRADIUS_SCOPE || 'https://management.core.windows.net/.default';
  const tokenResponse = await credential.getToken(scope);

  if (!tokenResponse?.token) {
    throw new Error('Failed to get EZRadius access token');
  }

  return tokenResponse.token;
}

export async function fetchEzRadiusAuthLogs(
  since: Date,
  until?: Date,
  maxRecords: number = 5000
): Promise<EzRadiusAuthEvent[]> {
  const baseUrl = process.env.EZRADIUS_URL || 'https://usa.ezradius.io';
  const token = await getEzRadiusToken();

  const allEvents: EzRadiusAuthEvent[] = [];
  let pageNumber = 0;
  let hasMore = true;

  while (hasMore) {
    const payload: AuditRequestPayload = {
      DateFrom: since.toISOString(),
      DateTo: (until || new Date()).toISOString(),
      MaxNumberOfRecords: maxRecords,
      PageNumber: pageNumber,
    };

    const response = await fetch(`${baseUrl}/api/Logs/GetAuthAuditLogs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`EZRadius API error ${response.status}: ${errorText}`);
    }

    const events: EzRadiusAuthEvent[] = await response.json();

    if (!events || events.length === 0) {
      hasMore = false;
      break;
    }

    allEvents.push(...events);

    if (events.length < maxRecords) {
      hasMore = false;
    } else {
      pageNumber++;
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return allEvents;
}
