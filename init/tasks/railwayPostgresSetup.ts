import { railwayApi } from '../api/railway';
import { updateConfigField } from '../utils/configHelpers';
import { getProjectConfig } from '../utils/getProjectConfig';
import { clearError, isComplete, markComplete, setError } from '../utils/progressTracking';
import { setSecretAsync } from './infisicalSetup';

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
  try {
    const config = await getProjectConfig();
    const { projectId, prodEnvironmentId, stagingEnvironmentId } = config.railway;
    const infisicalProjectId = config.infisical.projectId;
    const stagingEnabled = config.features.staging.enabled;

    if (!projectId) throw new Error('Railway project not configured. Run Railway Setup first.');
    if (!prodEnvironmentId) throw new Error('Railway prod environment missing. Re-run Railway Setup.');
    if (!infisicalProjectId) throw new Error('Infisical not configured. Run Infisical Setup first.');

    await clearError('railwayPostgres');

    let prodServiceId = config.railwayPostgres.prodServiceId;
    let stagingServiceId = config.railwayPostgres.stagingServiceId;

    // PROD POSTGRES
    if (!(await isComplete('railwayPostgres', 'ensureProdPostgresService'))) {
      const pg = await railwayApi.createPostgres(projectId, prodEnvironmentId, 'prod');
      prodServiceId = pg.id;
      await updateConfigField('railwayPostgres', 'prodServiceId', prodServiceId);
      await markComplete('railwayPostgres', 'ensureProdPostgresService');
      await onStepComplete?.();
    }

    if (!(await isComplete('railwayPostgres', 'storeProdPostgresUrl'))) {
      if (!prodServiceId) throw new Error('Prod Postgres service ID not set');
      const url = await railwayApi.getPostgresUrl(prodServiceId, prodEnvironmentId, 'prod', projectId);
      await setSecretAsync(infisicalProjectId, 'prod', 'DATABASE_URL', url, '/api');
      await markComplete('railwayPostgres', 'storeProdPostgresUrl');
      await onStepComplete?.();
    }

    // STAGING POSTGRES — gated on features.staging.enabled
    if (stagingEnabled && !(await isComplete('railwayPostgres', 'ensureStagingPostgresService'))) {
      if (!stagingEnvironmentId) throw new Error('Staging env missing despite staging being enabled');
      const pg = await railwayApi.createPostgres(projectId, stagingEnvironmentId, 'staging');
      stagingServiceId = pg.id;
      await updateConfigField('railwayPostgres', 'stagingServiceId', stagingServiceId);
      await markComplete('railwayPostgres', 'ensureStagingPostgresService');
      await onStepComplete?.();
    }

    if (stagingEnabled && !(await isComplete('railwayPostgres', 'storeStagingPostgresUrl'))) {
      if (!stagingServiceId) throw new Error('Staging Postgres service ID not set');
      if (!stagingEnvironmentId) throw new Error('Staging env missing despite staging being enabled');
      const url = await railwayApi.getPostgresUrl(stagingServiceId, stagingEnvironmentId, 'staging', projectId);
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
