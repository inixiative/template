import { updateConfigField } from '../utils/configHelpers';
import { getProjectConfig } from '../utils/getProjectConfig';
import { isComplete, markComplete, setError } from '../utils/progressTracking';
import { setSecretAsync } from './infisicalSetup';

/**
 * Store Bouncer API key in Infisical root environment.
 * Root secrets are inherited by prod and staging via Infisical imports.
 */
export const storeBouncerApiKey = async (apiKey: string): Promise<void> => {
  try {
    const config = await getProjectConfig();
    const infisicalProjectId = config.infisical.projectId;

    if (!infisicalProjectId) {
      throw new Error('Infisical project not configured. Run Infisical setup first.');
    }

    await updateConfigField('bouncer', 'configProjectName', config.project.name);

    if (!(await isComplete('bouncer', 'storeApiKey'))) {
      await setSecretAsync(infisicalProjectId, 'root', 'BOUNCER_API_KEY', apiKey, '/api');
      await markComplete('bouncer', 'storeApiKey');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await setError('bouncer', errorMsg);
    throw error;
  }
};
