import { infisicalApi } from '../api/infisical';
import { type ResendDomain, upsertDomain } from '../api/resend';
import { updateConfigField } from '../utils/configHelpers';
import { getProjectConfig } from '../utils/getProjectConfig';
import { markComplete } from '../utils/progressTracking';
import { getSecretAsync } from './infisicalSetup';

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

const getStoredResendApiKey = async (projectId: string): Promise<string> => {
  return getSecretAsync('RESEND_API_KEY', {
    projectId,
    environment: 'prod',
    path: '/api/',
  });
};

/**
 * Store Resend API key in Infisical for both prod and staging API folders.
 */
export const storeResendApiKey = async (projectId: string, apiKey: string): Promise<void> => {
  await syncResendProjectName();
  await infisicalApi.setSecret(projectId, 'prod', '/api/', 'RESEND_API_KEY', apiKey);
  await markComplete('resend', 'storeProdApiKey');
  await infisicalApi.setSecret(projectId, 'staging', '/api/', 'RESEND_API_KEY', apiKey);
  await markComplete('resend', 'storeStagingApiKey');
};

/**
 * Store from address in Infisical for both prod and staging API folders.
 */
export const storeResendFromAddress = async (projectId: string, fromAddress: string): Promise<void> => {
  await updateConfigField('resend', 'fromAddress', fromAddress);
  await syncResendProjectName();
  await infisicalApi.setSecret(projectId, 'prod', '/api/', 'EMAIL_FROM', fromAddress);
  await markComplete('resend', 'storeProdFromAddress');
  await infisicalApi.setSecret(projectId, 'staging', '/api/', 'EMAIL_FROM', fromAddress);
  await markComplete('resend', 'storeStagingFromAddress');
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

/**
 * Mark DNS confirmation complete and store the from address in config.
 */
export const confirmResendDnsSetup = async (fromAddress: string): Promise<void> => {
  await updateConfigField('resend', 'fromAddress', fromAddress);
  await syncResendProjectName();
  await markComplete('resend', 'confirmDns');
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
