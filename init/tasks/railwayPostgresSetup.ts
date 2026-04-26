import { railwayApi } from '../api/railway';
import { updateConfigField } from '../utils/configHelpers';
import { getProjectConfig } from '../utils/getProjectConfig';
import { clearError, isComplete, markComplete, setError } from '../utils/progressTracking';
import { retryWithTimeout } from '../utils/retry';
import { setSecretAsync } from './infisicalSetup';

// Match the Redis provisioning retry shape — Railway returns "provisioning" /
// "deploying" errors while the database service is being created.
const provisioningRetry = (label: string, timeoutLabel: string) => ({
  maxRetries: 100,
  delayMs: 3000,
  retryCondition: (error: Error) => {
    const msg = error.message.toLowerCase();
    return msg.includes('provisioning') || msg.includes('deploying');
  },
  timeoutMessage: `${label} ${timeoutLabel}`,
});

// getPostgresUrl polls until DATABASE_URL appears in the service variables
// (Railway populates this asynchronously after the service is created).
const urlRetry = (label: string) => ({
  maxRetries: 60,
  delayMs: 5000,
  retryCondition: (error: Error) => error.message.toLowerCase().includes('not found in service variables'),
  timeoutMessage: `${label} did not expose DATABASE_URL within 5 minutes`,
});

/**
 * Provision a Railway-managed Postgres service (one per environment) and store
 * its DATABASE_URL in Infisical at /api so the API + worker can connect.
 *
 * Mirrors the Redis provisioning pattern from railwaySetup.ts. Idempotent —
 * re-running skips substeps already marked complete.
 *
 * Pre-reqs: Railway project + environments already exist (i.e. Railway Setup
 * step has run). Infisical project already exists.
 */
export const setupRailwayPostgres = async (onStepComplete?: () => Promise<void>): Promise<void> => {
  // clearError up front — match the railwaySetup.ts pattern. If we throw from
  // a guard below, we don't want the previous run's error sticking around in
  // the UI on the next attempt.
  await clearError('railwayPostgres');

  try {
    const config = await getProjectConfig();
    const { projectId, prodEnvironmentId, stagingEnvironmentId } = config.railway;
    const infisicalProjectId = config.infisical.projectId;
    const stagingEnabled = config.features.staging.enabled;

    if (!projectId) throw new Error('Railway project not configured. Run Railway Setup first.');
    if (!prodEnvironmentId) throw new Error('Railway prod environment missing. Re-run Railway Setup.');
    if (!infisicalProjectId) throw new Error('Infisical not configured. Run Infisical Setup first.');

    let prodServiceId = config.railwayPostgres.prodServiceId;
    let stagingServiceId = config.railwayPostgres.stagingServiceId;

    // PROD POSTGRES
    if (!(await isComplete('railwayPostgres', 'ensureProdPostgresService'))) {
      const pg = await retryWithTimeout(
        () => railwayApi.createPostgres(projectId, prodEnvironmentId, 'prod'),
        provisioningRetry('Prod Postgres', 'provisioning timed out after 5 minutes'),
      );
      prodServiceId = pg.id;
      await updateConfigField('railwayPostgres', 'prodServiceId', prodServiceId);
      await markComplete('railwayPostgres', 'ensureProdPostgresService');
      await onStepComplete?.();
    }

    if (!(await isComplete('railwayPostgres', 'storeProdPostgresUrl'))) {
      if (!prodServiceId) throw new Error('Prod Postgres service ID not set');
      const url = await retryWithTimeout(
        () => railwayApi.getPostgresUrl(prodServiceId, prodEnvironmentId, 'prod', projectId),
        urlRetry('Prod Postgres'),
      );
      await setSecretAsync(infisicalProjectId, 'prod', 'DATABASE_URL', url, '/api');
      await markComplete('railwayPostgres', 'storeProdPostgresUrl');
      await onStepComplete?.();
    }

    // STAGING POSTGRES — gated on features.staging.enabled
    if (stagingEnabled && !(await isComplete('railwayPostgres', 'ensureStagingPostgresService'))) {
      if (!stagingEnvironmentId) throw new Error('Staging env missing despite staging being enabled');
      const pg = await retryWithTimeout(
        () => railwayApi.createPostgres(projectId, stagingEnvironmentId, 'staging'),
        provisioningRetry('Staging Postgres', 'provisioning timed out after 5 minutes'),
      );
      stagingServiceId = pg.id;
      await updateConfigField('railwayPostgres', 'stagingServiceId', stagingServiceId);
      await markComplete('railwayPostgres', 'ensureStagingPostgresService');
      await onStepComplete?.();
    }

    if (stagingEnabled && !(await isComplete('railwayPostgres', 'storeStagingPostgresUrl'))) {
      if (!stagingServiceId) throw new Error('Staging Postgres service ID not set');
      if (!stagingEnvironmentId) throw new Error('Staging env missing despite staging being enabled');
      const url = await retryWithTimeout(
        () => railwayApi.getPostgresUrl(stagingServiceId, stagingEnvironmentId, 'staging', projectId),
        urlRetry('Staging Postgres'),
      );
      await setSecretAsync(infisicalProjectId, 'staging', 'DATABASE_URL', url, '/api');
      await markComplete('railwayPostgres', 'storeStagingPostgresUrl');
      await onStepComplete?.();
    }

    // Capture the project name we configured against so future re-runs can detect drift.
    await updateConfigField('railwayPostgres', 'configProjectName', config.project.name);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setError('railwayPostgres', message);
    throw error;
  }
};
