import { infisicalApi } from '../api/infisical';
import { type ResendDomain, upsertDomain } from '../api/resend';
import { setProgressComplete, updateConfigField } from '../utils/configHelpers';
import { getProjectConfig } from '../utils/getProjectConfig';

/**
 * Store Resend API key in Infisical for both prod and staging API folders.
 */
export const storeResendApiKey = async (projectId: string, apiKey: string): Promise<void> => {
  await infisicalApi.setSecret(projectId, 'prod', '/api/', 'RESEND_API_KEY', apiKey);
  await setProgressComplete('email', 'storeProdApiKey');
  await infisicalApi.setSecret(projectId, 'staging', '/api/', 'RESEND_API_KEY', apiKey);
  await setProgressComplete('email', 'storeStagingApiKey');
};

/**
 * Store from address in Infisical for both prod and staging API folders.
 */
export const storeFromAddress = async (projectId: string, fromAddress: string): Promise<void> => {
  await infisicalApi.setSecret(projectId, 'prod', '/api/', 'EMAIL_FROM', fromAddress);
  await setProgressComplete('email', 'storeProdFromAddress');
  await infisicalApi.setSecret(projectId, 'staging', '/api/', 'EMAIL_FROM', fromAddress);
  await setProgressComplete('email', 'storeStagingFromAddress');
};

/**
 * Register the sending domain with Resend to retrieve DNS records.
 * Extracts the domain from the from address (e.g. noreply@acme.com → acme.com).
 */
export const registerDomain = async (apiKey: string, fromAddress: string): Promise<ResendDomain> => {
  const domain = fromAddress.split('@')[1];
  if (!domain) throw new Error(`Could not extract domain from "${fromAddress}"`);

  const result = await upsertDomain(apiKey, domain);

  await updateConfigField('email', 'domainId', result.id);
  await setProgressComplete('email', 'addDomain');

  return result;
};

/**
 * Mark DNS confirmation complete and store the from address in config.
 */
export const confirmDnsSetup = async (fromAddress: string): Promise<void> => {
  await updateConfigField('email', 'fromAddress', fromAddress);
  await setProgressComplete('email', 'confirmDns');
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
