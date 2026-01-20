const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

function getGHLToken(): string {
  const token = process.env.GHL_API_KEY;
  if (!token) {
    throw new Error('GHL_API_KEY environment variable is not set');
  }
  return token;
}

function getGHLLocationId(): string {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) {
    throw new Error('GHL_LOCATION_ID environment variable is not set');
  }
  return locationId;
}

async function ghlFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = getGHLToken();
  
  const response = await fetch(`${GHL_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Version': GHL_API_VERSION,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GHL API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

export interface GHLContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  tags?: string[];
  dateAdded?: string;
}

export interface GHLOpportunity {
  id: string;
  name: string;
  monetaryValue?: number;
  status?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  contact?: {
    id: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  dateAdded?: string;
}

export interface GHLPipeline {
  id: string;
  name: string;
  stages: {
    id: string;
    name: string;
  }[];
}

export async function getGHLContacts(limit = 100): Promise<GHLContact[]> {
  const locationId = getGHLLocationId();
  const data = await ghlFetch(`/contacts/?locationId=${locationId}&limit=${limit}`);
  return data.contacts || [];
}

export async function getGHLOpportunities(limit = 100): Promise<GHLOpportunity[]> {
  const locationId = getGHLLocationId();
  const data = await ghlFetch(`/opportunities/search?location_id=${locationId}&limit=${limit}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return data.opportunities || [];
}

export async function getGHLPipelines(): Promise<GHLPipeline[]> {
  const locationId = getGHLLocationId();
  const data = await ghlFetch(`/opportunities/pipelines?locationId=${locationId}`);
  return data.pipelines || [];
}

export function mapGHLStageToScan2Plan(stageName: string): string {
  const stageNameLower = stageName.toLowerCase();
  
  if (stageNameLower.includes('new') || stageNameLower.includes('lead')) {
    return 'Leads';
  }
  if (stageNameLower.includes('contact') || stageNameLower.includes('reach')) {
    return 'Contacted';
  }
  if (stageNameLower.includes('proposal') || stageNameLower.includes('quote') || stageNameLower.includes('qualified')) {
    return 'Proposal';
  }
  if (stageNameLower.includes('negotiat') || stageNameLower.includes('decision')) {
    return 'Negotiation';
  }
  if (stageNameLower.includes('won') || stageNameLower.includes('closed won') || stageNameLower.includes('sale')) {
    return 'Closed Won';
  }
  if (stageNameLower.includes('lost') || stageNameLower.includes('closed lost') || stageNameLower.includes('dead')) {
    return 'Closed Lost';
  }
  if (stageNameLower.includes('hold') || stageNameLower.includes('pause') || stageNameLower.includes('wait')) {
    return 'On Hold';
  }
  
  return 'Leads';
}

export interface SyncedGHLOpportunity {
  ghlId: string;
  name: string;
  amount: number;
  stage: string;
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

export async function syncGHLOpportunities(): Promise<{ synced: number; errors: string[]; opportunities: SyncedGHLOpportunity[] }> {
  const errors: string[] = [];
  const syncedOpps: SyncedGHLOpportunity[] = [];

  try {
    const [opportunities, pipelines] = await Promise.all([
      getGHLOpportunities(100),
      getGHLPipelines(),
    ]);

    const stageMap: Record<string, string> = {};
    for (const pipeline of pipelines) {
      for (const stage of pipeline.stages) {
        stageMap[stage.id] = stage.name;
      }
    }

    for (const opp of opportunities) {
      try {
        const stageName = opp.pipelineStageId ? stageMap[opp.pipelineStageId] || 'Unknown' : 'Unknown';
        
        syncedOpps.push({
          ghlId: opp.id,
          name: opp.name || 'Untitled Opportunity',
          amount: opp.monetaryValue || 0,
          stage: mapGHLStageToScan2Plan(stageName),
          contact: opp.contact ? {
            name: opp.contact.name,
            email: opp.contact.email,
            phone: opp.contact.phone,
          } : undefined,
        });
      } catch (oppErr: any) {
        errors.push(`Opportunity ${opp.id}: ${oppErr.message}`);
      }
    }

    return { synced: syncedOpps.length, errors, opportunities: syncedOpps };
  } catch (err: any) {
    errors.push(`Failed to fetch opportunities: ${err.message}`);
    return { synced: 0, errors, opportunities: [] };
  }
}

export async function testGHLConnection(): Promise<{ connected: boolean; message: string; contactCount?: number; opportunityCount?: number }> {
  try {
    const [contacts, opportunities] = await Promise.all([
      getGHLContacts(100),
      getGHLOpportunities(100),
    ]);

    return {
      connected: true,
      message: 'Go High Level connected successfully',
      contactCount: contacts.length,
      opportunityCount: opportunities.length,
    };
  } catch (err: any) {
    return {
      connected: false,
      message: `Go High Level connection failed: ${err.message}`,
    };
  }
}
