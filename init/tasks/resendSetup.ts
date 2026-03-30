import { resolveMx, resolveTxt } from 'dns/promises';
import { type ResendDomain, type ResendDnsRecord, getDomain, upsertDomain, verifyDomain } from '../api/resend';
import { updateConfigField } from '../utils/configHelpers';
import { getProjectConfig } from '../utils/getProjectConfig';
import { markComplete } from '../utils/progressTracking';
import { getSecretAsync, setSecretAsync } from './infisicalSetup';

const getDomainName = (fromAddress: string): string => {
  const domainName = fromAddress.split('@')[1];
  if (!domainName) {
    throw new Error(`Could not extract domain from "${fromAddress}"`);
  }
  return domainName;
};

const syncResendProjectName = async (): Promise<void> => {
  const config = await getProjectConfig();
  await updateConfigField('resend', 'configProjectName', config.project.name);
};

export const getStoredResendApiKey = async (projectId: string): Promise<string> => {
  return getSecretAsync('RESEND_API_KEY', {
    projectId,
    environment: 'root',
    path: '/api/',
  });
};

/**
 * Store Resend API key in Infisical root environment.
 * Root secrets are inherited by prod and staging via Infisical imports.
 */
export const storeResendApiKey = async (projectId: string, apiKey: string): Promise<void> => {
  await syncResendProjectName();
  await setSecretAsync(projectId, 'root', 'RESEND_API_KEY', apiKey, '/api');
  await markComplete('resend', 'storeApiKey');
};

/**
 * Store from address in Infisical root environment.
 * Root secrets are inherited by prod and staging via Infisical imports.
 */
export const storeResendFromAddress = async (projectId: string, fromAddress: string): Promise<void> => {
  await updateConfigField('resend', 'fromAddress', fromAddress);
  await syncResendProjectName();
  await setSecretAsync(projectId, 'root', 'EMAIL_FROM', fromAddress, '/api');
  await markComplete('resend', 'storeFromAddress');
};

/**
 * Ensure the sending domain exists in Resend and capture its DNS records.
 */
export const ensureResendDomain = async (
  projectId: string,
  fromAddress: string,
  apiKey?: string,
): Promise<ResendDomain> => {
  const result = await upsertDomain(apiKey ?? (await getStoredResendApiKey(projectId)), getDomainName(fromAddress));

  await updateConfigField('resend', 'fromAddress', fromAddress);
  await updateConfigField('resend', 'domainId', result.id);
  await syncResendProjectName();
  await markComplete('resend', 'addDomain');

  return result;
};

export type DnsCheckResult = {
  record: ResendDnsRecord;
  found: boolean;
};

/**
 * Check DNS records locally via resolver before hitting Resend's API.
 * Returns which records are found vs missing.
 */
const checkDnsLocally = async (records: ResendDnsRecord[], domain: string): Promise<DnsCheckResult[]> => {
  const results: DnsCheckResult[] = [];

  for (const record of records) {
    // Resend returns relative names (e.g. "resend._domainkey") — append domain for FQDN
    const fqdn = record.name.endsWith(domain) ? record.name : `${record.name}.${domain}`;
    try {
      if (record.type === 'TXT') {
        const txtRecords = await resolveTxt(fqdn);
        const flat = txtRecords.map((chunks) => chunks.join(''));
        results.push({ record, found: flat.some((v) => v.includes(record.value.slice(0, 40))) });
      } else if (record.type === 'MX') {
        const mxRecords = await resolveMx(fqdn);
        results.push({
          record,
          found: mxRecords.some((mx) => mx.exchange.replace(/\.$/, '') === record.value.replace(/\.$/, '')),
        });
      } else {
        results.push({ record, found: true });
      }
    } catch {
      results.push({ record, found: false });
    }
  }

  return results;
};

export type DnsVerificationResult = {
  verified: boolean;
  domain: ResendDomain;
  failedRecords: Array<{ type: string; name: string; status: string }>;
  /** Local DNS check results (before Resend API) */
  dnsCheck: DnsCheckResult[];
};

/**
 * Check DNS locally first, then trigger Resend verification if records are propagated.
 * Marks complete only if Resend confirms all records are verified.
 */
export const confirmResendDnsSetup = async (
  fromAddress: string,
  onProgress?: (message: string) => void,
): Promise<DnsVerificationResult> => {
  const config = await getProjectConfig();
  const domainId = config.resend.domainId;
  const infisicalProjectId = config.infisical.projectId;

  if (!domainId) {
    throw new Error('No domain ID found. Register the domain first.');
  }

  const apiKey = await getSecretAsync('RESEND_API_KEY', {
    projectId: infisicalProjectId,
    environment: 'root',
    path: '/api/',
  });

  // Step 1: Check DNS locally (instant, no API call)
  onProgress?.('Checking DNS records locally...');
  const currentDomain = await getDomain(apiKey, domainId);
  const domainName = getDomainName(fromAddress);
  const dnsCheck = await checkDnsLocally(currentDomain.records ?? [], domainName);
  const allFoundLocally = dnsCheck.every((r) => r.found);

  if (!allFoundLocally) {
    const missing = dnsCheck.filter((r) => !r.found);
    return {
      verified: false,
      domain: currentDomain,
      failedRecords: missing.map((r) => ({ type: r.record.type, name: r.record.name, status: 'not_propagated' })),
      dnsCheck,
    };
  }

  // Step 2: Check if Resend already shows verified (avoid re-triggering)
  onProgress?.('DNS propagated. Checking Resend status...');
  const isAlreadyVerified =
    currentDomain.status === 'verified' || (currentDomain.records ?? []).every((r) => r.status === 'verified');

  let domain: ResendDomain;
  if (isAlreadyVerified) {
    domain = currentDomain;
  } else {
    // Not yet verified on Resend — trigger verification and poll
    onProgress?.('Triggering Resend verification...');
    await verifyDomain(apiKey, domainId);
    // Wait for Resend to process the check
    await new Promise((resolve) => setTimeout(resolve, 3000));
    domain = await getDomain(apiKey, domainId);
  }

  const failedRecords = (domain.records ?? [])
    .filter((r) => r.status !== 'verified' && r.status !== 'not_started')
    .map((r) => ({ type: r.type, name: r.name, status: r.status }));

  const allVerified = domain.status === 'verified' || (domain.records ?? []).every((r) => r.status === 'verified');

  if (allVerified) {
    await updateConfigField('resend', 'fromAddress', fromAddress);
    await syncResendProjectName();
    await markComplete('resend', 'confirmDns');
  }

  return { verified: allVerified, domain, failedRecords, dnsCheck };
};

/**
 * Get the current Infisical project ID from config.
 * Throws if Infisical hasn't been set up yet.
 */
export const getInfisicalProjectId = async (): Promise<string> => {
  const config = await getProjectConfig();
  const { projectId } = config.infisical;
  if (!projectId) {
    throw new Error('Infisical project not configured. Complete "2. Infisical Setup" first.');
  }
  return projectId;
};
