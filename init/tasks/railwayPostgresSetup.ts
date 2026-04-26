import { railwayApi } from '../api/railway';
import { updateConfigField } from '../utils/configHelpers';
import { getProjectConfig } from '../utils/getProjectConfig';
import { clearError, isComplete, markComplete, setError } from '../utils/progressTracking';
import { retryWithTimeout } from '../utils/retry';
import { setSecretAsync } from './infisicalSetup';

// Match Redis provisioning retry shape — Railway returns "provisioning" /
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

// getPostgresUrl polls until DATABASE_URL appears in service variables.
const urlRetry = (label: string) => ({
  maxRetries: 60,
  delayMs: 5000,
  retryCondition: (error: Error) => error.message.toLowerCase().includes('not found in service variables'),
  timeoutMessage: `${label} did not expose DATABASE_URL within 5 minutes`,
});

// volumeRetry: Railway populates the volume async after service creation.
const volumeRetry = (label: string) => ({
  maxRetries: 60,
  delayMs: 5000,
  retryCondition: (error: Error) => error.message.toLowerCase().includes('volume not found'),
  timeoutMessage: `${label} volume did not appear within 5 minutes`,
});

const fetchVolume = async (
  projectId: string,
  serviceName: string,
  label: string,
): Promise<{ id: string; name: string }> => {
  const volume = await railwayApi.getServiceVolume(projectId, serviceName);
  if (!volume) throw new Error(`${label} volume not found yet. Retry once Railway finishes provisioning.`);
  return volume;
};

/**
 * Provision Railway-managed Postgres services (one per environment), rename
 * them to `${project}-${env}-postgres`, capture + rename their data volumes
 * to `${project}-${env}-postgres-data`, then store DATABASE_URL in Infisical
 * at /api so the API + worker can connect.
 *
 * Mirrors the createRedis → captureVolume → renameService → renameVolume
 * pattern from railwaySetup.ts. Idempotent — re-runs skip completed steps.
 */
export const setupRailwayPostgres = async (onStepComplete?: () => Promise<void>): Promise<void> => {
  await clearError('railwayPostgres');

  try {
    const config = await getProjectConfig();
    const { projectId, prodEnvironmentId, stagingEnvironmentId } = config.railway;
    const infisicalProjectId = config.infisical.projectId;
    const stagingEnabled = config.features.staging.enabled;
    const project = config.project.name;

    if (!projectId) throw new Error('Railway project not configured. Run Railway Setup first.');
    if (!prodEnvironmentId) throw new Error('Railway prod environment missing. Re-run Railway Setup.');
    if (!infisicalProjectId) throw new Error('Infisical not configured. Run Infisical Setup first.');

    let prodServiceId = config.railwayPostgres.prodServiceId;
    let prodVolumeId = config.railwayPostgres.prodVolumeId;
    let stagingServiceId = config.railwayPostgres.stagingServiceId;
    let stagingVolumeId = config.railwayPostgres.stagingVolumeId;

    // ─── PROD ────────────────────────────────────────────────────────────────

    if (!(await isComplete('railwayPostgres', 'ensureProdPostgresService'))) {
      if (!prodServiceId) {
        const pg = await retryWithTimeout(
          () => railwayApi.createPostgres(projectId, prodEnvironmentId, 'prod'),
          provisioningRetry('Prod Postgres', 'provisioning timed out after 5 minutes'),
        );
        prodServiceId = pg.id;
        await updateConfigField('railwayPostgres', 'prodServiceId', prodServiceId);
      }
      await markComplete('railwayPostgres', 'ensureProdPostgresService');
      await onStepComplete?.();
    }

    if (!(await isComplete('railwayPostgres', 'captureProdPostgresVolume'))) {
      if (!prodVolumeId) {
        const volume = await retryWithTimeout(
          () => fetchVolume(projectId, `${project}-prod-postgres`, 'Prod Postgres'),
          volumeRetry('Prod Postgres'),
        );
        prodVolumeId = volume.id;
        await updateConfigField('railwayPostgres', 'prodVolumeId', prodVolumeId);
      }
      await markComplete('railwayPostgres', 'captureProdPostgresVolume');
      await onStepComplete?.();
    }

    if (!(await isComplete('railwayPostgres', 'renameProdPostgresService'))) {
      if (!prodServiceId) throw new Error('Prod Postgres service ID missing');
      await railwayApi.renameService(prodServiceId, `${project}-prod-postgres`);
      await markComplete('railwayPostgres', 'renameProdPostgresService');
      await onStepComplete?.();
    }

    if (!(await isComplete('railwayPostgres', 'renameProdPostgresVolume'))) {
      if (!prodVolumeId) throw new Error('Prod Postgres volume ID missing');
      await railwayApi.renameVolume(prodVolumeId, `${project}-prod-postgres-data`);
      await markComplete('railwayPostgres', 'renameProdPostgresVolume');
      await onStepComplete?.();
    }

    if (!(await isComplete('railwayPostgres', 'storeProdPostgresUrl'))) {
      if (!prodServiceId) throw new Error('Prod Postgres service ID missing');
      const url = await retryWithTimeout(
        () => railwayApi.getPostgresUrl(prodServiceId, prodEnvironmentId, 'prod', projectId),
        urlRetry('Prod Postgres'),
      );
      await setSecretAsync(infisicalProjectId, 'prod', 'DATABASE_URL', url, '/api');
      await markComplete('railwayPostgres', 'storeProdPostgresUrl');
      await onStepComplete?.();
    }

    // ─── STAGING (gated on features.staging.enabled) ─────────────────────────

    if (stagingEnabled && !(await isComplete('railwayPostgres', 'ensureStagingPostgresService'))) {
      if (!stagingEnvironmentId) throw new Error('Staging env missing despite staging being enabled');
      if (!stagingServiceId) {
        const pg = await retryWithTimeout(
          () => railwayApi.createPostgres(projectId, stagingEnvironmentId, 'staging'),
          provisioningRetry('Staging Postgres', 'provisioning timed out after 5 minutes'),
        );
        stagingServiceId = pg.id;
        await updateConfigField('railwayPostgres', 'stagingServiceId', stagingServiceId);
      }
      await markComplete('railwayPostgres', 'ensureStagingPostgresService');
      await onStepComplete?.();
    }

    if (stagingEnabled && !(await isComplete('railwayPostgres', 'captureStagingPostgresVolume'))) {
      if (!stagingVolumeId) {
        const volume = await retryWithTimeout(
          () => fetchVolume(projectId, `${project}-staging-postgres`, 'Staging Postgres'),
          volumeRetry('Staging Postgres'),
        );
        stagingVolumeId = volume.id;
        await updateConfigField('railwayPostgres', 'stagingVolumeId', stagingVolumeId);
      }
      await markComplete('railwayPostgres', 'captureStagingPostgresVolume');
      await onStepComplete?.();
    }

    if (stagingEnabled && !(await isComplete('railwayPostgres', 'renameStagingPostgresService'))) {
      if (!stagingServiceId) throw new Error('Staging Postgres service ID missing');
      await railwayApi.renameService(stagingServiceId, `${project}-staging-postgres`);
      await markComplete('railwayPostgres', 'renameStagingPostgresService');
      await onStepComplete?.();
    }

    if (stagingEnabled && !(await isComplete('railwayPostgres', 'renameStagingPostgresVolume'))) {
      if (!stagingVolumeId) throw new Error('Staging Postgres volume ID missing');
      await railwayApi.renameVolume(stagingVolumeId, `${project}-staging-postgres-data`);
      await markComplete('railwayPostgres', 'renameStagingPostgresVolume');
      await onStepComplete?.();
    }

    if (stagingEnabled && !(await isComplete('railwayPostgres', 'storeStagingPostgresUrl'))) {
      if (!stagingServiceId) throw new Error('Staging Postgres service ID missing');
      if (!stagingEnvironmentId) throw new Error('Staging env missing despite staging being enabled');
      const url = await retryWithTimeout(
        () => railwayApi.getPostgresUrl(stagingServiceId, stagingEnvironmentId, 'staging', projectId),
        urlRetry('Staging Postgres'),
      );
      await setSecretAsync(infisicalProjectId, 'staging', 'DATABASE_URL', url, '/api');
      await markComplete('railwayPostgres', 'storeStagingPostgresUrl');
      await onStepComplete?.();
    }

    await updateConfigField('railwayPostgres', 'configProjectName', config.project.name);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setError('railwayPostgres', message);
    throw error;
  }
};
