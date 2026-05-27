import { railwayApi } from '../api/railway';
import { updateConfigField } from '../utils/configHelpers';
import { getProjectConfig } from '../utils/getProjectConfig';
import { clearError, isComplete, markComplete, setError } from '../utils/progressTracking';
import { retryWithTimeout } from '../utils/retry';
import { setSecretAsync } from './infisicalSetup';

const ensureBucketRetry = (label: string) => ({
  maxRetries: 20,
  delayMs: 3000,
  retryCondition: (error: Error) => {
    const msg = error.message.toLowerCase();
    return msg.includes('provisioning') || msg.includes('deploying') || msg.includes('rate limit');
  },
  timeoutMessage: `${label} provisioning timed out after 1 minute`,
});

const credentialsRetry = (label: string) => ({
  maxRetries: 60,
  delayMs: 5000,
  retryCondition: (error: Error) => error.message.toLowerCase().includes('credentials not ready'),
  timeoutMessage: `${label} did not expose S3 credentials within 5 minutes`,
});

const writeBucketCredentials = async (
  infisicalProjectId: string,
  infisicalEnvironment: 'prod' | 'staging',
  systemBucketId: string,
  userBucketId: string,
  railwayEnvironmentId: string,
  railwayProjectId: string,
): Promise<void> => {
  const system = await retryWithTimeout(
    () => railwayApi.getBucketCredentials(systemBucketId, railwayEnvironmentId, railwayProjectId),
    credentialsRetry(`${infisicalEnvironment} system bucket`),
  );
  const user = await retryWithTimeout(
    () => railwayApi.getBucketCredentials(userBucketId, railwayEnvironmentId, railwayProjectId),
    credentialsRetry(`${infisicalEnvironment} user bucket`),
  );

  // System + user buckets share account-level credentials (endpoint, region, keys).
  // Bucket names differ — one per bucket. urlStyle is path|virtual; map to STORAGE_FORCE_PATH_STYLE.
  const forcePathStyle = system.urlStyle?.toLowerCase() === 'path' ? 'true' : 'false';

  await setSecretAsync(infisicalProjectId, infisicalEnvironment, 'STORAGE_ENDPOINT', system.endpoint, '/api');
  await setSecretAsync(infisicalProjectId, infisicalEnvironment, 'STORAGE_REGION', system.region, '/api');
  await setSecretAsync(infisicalProjectId, infisicalEnvironment, 'STORAGE_ACCESS_KEY_ID', system.accessKeyId, '/api');
  await setSecretAsync(
    infisicalProjectId,
    infisicalEnvironment,
    'STORAGE_SECRET_ACCESS_KEY',
    system.secretAccessKey,
    '/api',
  );
  await setSecretAsync(infisicalProjectId, infisicalEnvironment, 'STORAGE_FORCE_PATH_STYLE', forcePathStyle, '/api');
  await setSecretAsync(infisicalProjectId, infisicalEnvironment, 'STORAGE_BUCKET_SYSTEM', system.bucket, '/api');
  await setSecretAsync(infisicalProjectId, infisicalEnvironment, 'STORAGE_BUCKET_USER', user.bucket, '/api');
};

/**
 * Provision Railway-managed Buckets (S3-compatible storage).
 *
 * Uses Railway's undocumented but functional GraphQL API:
 *   - bucketCreate(input: BucketCreateInput!) — creates a project-level bucket
 *   - project(id) { buckets { id name } } — lists existing buckets for idempotency
 *   - bucketS3Credentials(bucketId, environmentId, projectId) — per-env S3 credentials
 *
 * Creates 4 buckets per project for full segregation (system/user × prod/staging):
 *   ${project}-prod-system, ${project}-prod-user
 *   ${project}-staging-system, ${project}-staging-user  (if staging enabled)
 *
 * Writes per-environment STORAGE_* secrets to Infisical at /api.
 * Idempotent — re-runs skip completed steps and reuse existing buckets.
 */
export const setupRailwayBuckets = async (onStepComplete?: () => Promise<void>): Promise<void> => {
  await clearError('railwayBuckets');

  try {
    const config = await getProjectConfig();
    const { projectId, prodEnvironmentId, stagingEnvironmentId } = config.railway;
    const infisicalProjectId = config.infisical.projectId;
    const stagingEnabled = config.features.staging.enabled;
    const project = config.project.name;

    if (!projectId) throw new Error('Railway project not configured. Run Railway Setup first.');
    if (!prodEnvironmentId) throw new Error('Railway prod environment missing. Re-run Railway Setup.');
    if (!infisicalProjectId) throw new Error('Infisical not configured. Run Infisical Setup first.');

    let prodSystemBucketId = config.railwayBuckets.prodSystemServiceId;
    let prodUserBucketId = config.railwayBuckets.prodUserServiceId;
    let stagingSystemBucketId = config.railwayBuckets.stagingSystemServiceId;
    let stagingUserBucketId = config.railwayBuckets.stagingUserServiceId;

    // ─── PROD ────────────────────────────────────────────────────────────────

    if (!(await isComplete('railwayBuckets', 'ensureProdSystemBucket'))) {
      if (!prodSystemBucketId) {
        const bucket = await retryWithTimeout(
          () => railwayApi.ensureBucket(projectId, `${project}-prod-system`),
          ensureBucketRetry('Prod system bucket'),
        );
        prodSystemBucketId = bucket.id;
        await updateConfigField('railwayBuckets', 'prodSystemServiceId', prodSystemBucketId);
      }
      await markComplete('railwayBuckets', 'ensureProdSystemBucket');
      await onStepComplete?.();
    }

    if (!(await isComplete('railwayBuckets', 'ensureProdUserBucket'))) {
      if (!prodUserBucketId) {
        const bucket = await retryWithTimeout(
          () => railwayApi.ensureBucket(projectId, `${project}-prod-user`),
          ensureBucketRetry('Prod user bucket'),
        );
        prodUserBucketId = bucket.id;
        await updateConfigField('railwayBuckets', 'prodUserServiceId', prodUserBucketId);
      }
      await markComplete('railwayBuckets', 'ensureProdUserBucket');
      await onStepComplete?.();
    }

    if (!(await isComplete('railwayBuckets', 'storeProdCredentials'))) {
      if (!prodSystemBucketId || !prodUserBucketId) throw new Error('Prod bucket IDs missing');
      await writeBucketCredentials(
        infisicalProjectId,
        'prod',
        prodSystemBucketId,
        prodUserBucketId,
        prodEnvironmentId,
        projectId,
      );
      await markComplete('railwayBuckets', 'storeProdCredentials');
      await onStepComplete?.();
    }

    // ─── STAGING (gated on features.staging.enabled) ─────────────────────────

    if (stagingEnabled && !(await isComplete('railwayBuckets', 'ensureStagingSystemBucket'))) {
      if (!stagingEnvironmentId) throw new Error('Staging env missing despite staging being enabled');
      if (!stagingSystemBucketId) {
        const bucket = await retryWithTimeout(
          () => railwayApi.ensureBucket(projectId, `${project}-staging-system`),
          ensureBucketRetry('Staging system bucket'),
        );
        stagingSystemBucketId = bucket.id;
        await updateConfigField('railwayBuckets', 'stagingSystemServiceId', stagingSystemBucketId);
      }
      await markComplete('railwayBuckets', 'ensureStagingSystemBucket');
      await onStepComplete?.();
    }

    if (stagingEnabled && !(await isComplete('railwayBuckets', 'ensureStagingUserBucket'))) {
      if (!stagingUserBucketId) {
        const bucket = await retryWithTimeout(
          () => railwayApi.ensureBucket(projectId, `${project}-staging-user`),
          ensureBucketRetry('Staging user bucket'),
        );
        stagingUserBucketId = bucket.id;
        await updateConfigField('railwayBuckets', 'stagingUserServiceId', stagingUserBucketId);
      }
      await markComplete('railwayBuckets', 'ensureStagingUserBucket');
      await onStepComplete?.();
    }

    if (stagingEnabled && !(await isComplete('railwayBuckets', 'storeStagingCredentials'))) {
      if (!stagingSystemBucketId || !stagingUserBucketId) throw new Error('Staging bucket IDs missing');
      if (!stagingEnvironmentId) throw new Error('Staging env missing despite staging being enabled');
      await writeBucketCredentials(
        infisicalProjectId,
        'staging',
        stagingSystemBucketId,
        stagingUserBucketId,
        stagingEnvironmentId,
        projectId,
      );
      await markComplete('railwayBuckets', 'storeStagingCredentials');
      await onStepComplete?.();
    }

    await updateConfigField('railwayBuckets', 'configProjectName', config.project.name);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setError('railwayBuckets', message);
    throw error;
  }
};
