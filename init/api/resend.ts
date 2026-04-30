const RESEND_API = 'https://api.resend.com';

export type ResendDnsRecord = {
  record: string;
  name: string;
  type: string;
  ttl: string;
  status: string;
  value: string;
  priority?: number;
};

export type ResendDomain = {
  id: string;
  name: string;
  status: string;
  records: ResendDnsRecord[];
  region: string;
  created_at: string;
};

const resendFetch = async (apiKey: string, path: string, options: RequestInit = {}): Promise<unknown> => {
  const response = await fetch(`${RESEND_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const message = (data as { message?: string })?.message ?? response.statusText;
    throw new Error(`Resend API error (${response.status}): ${message}`);
  }

  return data;
};

/**
 * Register a sending domain with Resend.
 * Returns the domain object including DNS records to configure.
 * Idempotent — if the domain already exists, fetches and returns it.
 */
export const upsertDomain = async (apiKey: string, domainName: string): Promise<ResendDomain> => {
  try {
    const data = await resendFetch(apiKey, '/domains', {
      method: 'POST',
      body: JSON.stringify({ name: domainName }),
    });
    return data as ResendDomain;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('already exists') || error.message.includes('registered already'))
    ) {
      const data = await resendFetch(apiKey, '/domains');
      const domains = (data as { data: ResendDomain[] }).data ?? [];
      const existing = domains.find((d) => d.name === domainName);
      if (!existing) throw new Error(`Domain ${domainName} not found after conflict`);
      // List endpoint doesn't include records — fetch full domain
      return getDomain(apiKey, existing.id);
    }
    throw error;
  }
};

/**
 * Get domain details including current DNS record statuses.
 */
export const getDomain = async (apiKey: string, domainId: string): Promise<ResendDomain> => {
  const data = await resendFetch(apiKey, `/domains/${domainId}`);
  return data as ResendDomain;
};

/**
 * Trigger domain verification check with Resend, then return updated domain.
 */
export const verifyDomain = async (apiKey: string, domainId: string): Promise<ResendDomain> => {
  await resendFetch(apiKey, `/domains/${domainId}/verify`, { method: 'POST' });
  // Re-fetch to get updated statuses after verification trigger
  return getDomain(apiKey, domainId);
};
