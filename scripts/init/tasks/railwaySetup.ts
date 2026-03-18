import { createRailwayConnection, ensureRailwaySync } from '../api/infisicalRailway';
import {
  connectServiceToGitHub,
  createEnvironment,
  createProject,
  createRedis,
  createService,
  deleteEnvironment,
  getLatestDeployment,
  getProjectEnvironments,
  getRailwayUserToken,
  getRailwayWorkspaceToken,
  getRedisUrl,
  getServiceDomain,
  getServiceVolume,
  isServiceConnectedToGitHub,
  renameService,
  renameVolume,
  triggerServiceDeployment,
  updateServiceInstanceConfig,
} from '../api/railway';
import {
  clearAllProgress,
  clearConfigError,
  isProgressComplete,
  setConfigError,
  setProgressComplete,
  updateConfigField,
} from '../utils/configHelpers';
import { getProjectConfig } from '../utils/getProjectConfig';
import { retryWithTimeout } from '../utils/retry';
import { getSecret, setSecret } from './infisicalSetup';

type SetupResult = {
  projectId: string;
  prodApiServiceId: string;
  stagingApiServiceId: string;
  prodWorkerServiceId: string;
  stagingWorkerServiceId: string;
  prodRedisServiceId: string;
  stagingRedisServiceId: string;
  prodApiUrl: string;
  stagingApiUrl: string;
  prodRedisUrl: string;
  stagingRedisUrl: string;
};

const RAILWAY_BUILD_COMMAND = 'bun install --frozen-lockfile --ignore-scripts && bun run --cwd packages/db db:generate';
const API_SERVICE_CONFIG = {
  rootDirectory: '.',
  buildCommand: RAILWAY_BUILD_COMMAND,
  startCommand: 'bun run --cwd apps/api start',
};
const WORKER_SERVICE_CONFIG = {
  rootDirectory: '.',
  buildCommand: RAILWAY_BUILD_COMMAND,
  startCommand: 'bun run --cwd apps/api start:worker',
};

/**
 * Setup Railway infrastructure (API + Worker + Redis)
 */
export const setupRailway = async (
  selectedWorkspaceId: string,
  onStepComplete?: () => Promise<void>,
): Promise<SetupResult> => {
  try {
    const config = await getProjectConfig();
    const configProjectName = config.project.name;
    const infisicalProjectId = config.infisical.projectId;

    if (!infisicalProjectId) {
      throw new Error('Infisical project not configured. Run Infisical setup first.');
    }

    // Clear any previous error
    await clearConfigError('railway');

    // Check if config is stale (project name changed since last setup)
    const isStale = config.railway.configProjectName && config.railway.configProjectName !== configProjectName;

    if (isStale) {
      // Clearing stale config (project name changed)
      await updateConfigField('railway', 'workspaceId', '');
      await updateConfigField('railway', 'projectId', '');
      await updateConfigField('railway', 'prodEnvironmentId', '');
      await updateConfigField('railway', 'stagingEnvironmentId', '');
      await updateConfigField('railway', 'prodApiServiceId', '');
      await updateConfigField('railway', 'stagingApiServiceId', '');
      await updateConfigField('railway', 'prodWorkerServiceId', '');
      await updateConfigField('railway', 'stagingWorkerServiceId', '');
      await updateConfigField('railway', 'prodRedisServiceId', '');
      await updateConfigField('railway', 'stagingRedisServiceId', '');
      await updateConfigField('railway', 'configProjectName', '');
      await clearAllProgress('railway');
    }

    // Variables to hold intermediate results
    let workspaceId = config.railway.workspaceId;
    let projectId = config.railway.projectId;
    let prodApiServiceId = config.railway.prodApiServiceId;
    let stagingApiServiceId = config.railway.stagingApiServiceId;
    let prodWorkerServiceId = config.railway.prodWorkerServiceId;
    let stagingWorkerServiceId = config.railway.stagingWorkerServiceId;
    let prodRedisServiceId = config.railway.prodRedisServiceId;
    let stagingRedisServiceId = config.railway.stagingRedisServiceId;
    let prodRedisVolumeId = config.railway.prodRedisVolumeId;
    let stagingRedisVolumeId = config.railway.stagingRedisVolumeId;

    // Step 1: Store workspace and mark selected
    if (!(await isProgressComplete('railway', 'selectWorkspace'))) {
      workspaceId = selectedWorkspaceId;
      await updateConfigField('railway', 'workspaceId', workspaceId);
      await updateConfigField('railway', 'configProjectName', configProjectName);
      await setProgressComplete('railway', 'selectWorkspace');
      await onStepComplete?.();
    }

    // Step 2: Store Railway user token in Infisical
    if (!(await isProgressComplete('railway', 'storeRailwayToken'))) {
      await getRailwayUserToken(); // This will upload to Infisical if not already there
      await setProgressComplete('railway', 'storeRailwayToken');
      await onStepComplete?.();
    }

    // Step 3: Create Railway project
    if (!(await isProgressComplete('railway', 'createProject'))) {
      const project = await createProject(workspaceId, configProjectName);
      projectId = project.id;

      await updateConfigField('railway', 'projectId', projectId);
      await setProgressComplete('railway', 'createProject');
      await onStepComplete?.();
    }

    // Get existing environments first to check what needs to be created
    let environments = await getProjectEnvironments(projectId);
    let prodEnv = environments.find((env) => env.name === 'prod');
    let stagingEnv = environments.find((env) => env.name === 'staging');

    // Step 3a: Create "prod" environment and delete "production"
    if (!(await isProgressComplete('railway', 'renameProductionEnv'))) {
      // Create prod if it doesn't exist
      if (!prodEnv) {
        try {
          prodEnv = await createEnvironment(projectId, 'prod');

          // Store prod environment ID in config
          await updateConfigField('railway', 'prodEnvironmentId', prodEnv.id);

          // Store in Infisical for reference
          setSecret(infisicalProjectId, 'root', 'RAILWAY_PROD_ENVIRONMENT_ID', prodEnv.id);
        } catch (_error) {
          // Ignore if already exists
        }
      } else {
        // Prod exists, store its ID
        await updateConfigField('railway', 'prodEnvironmentId', prodEnv.id);
        setSecret(infisicalProjectId, 'root', 'RAILWAY_PROD_ENVIRONMENT_ID', prodEnv.id);
      }

      // Delete production if it exists
      const productionEnv = environments.find((env) => env.name === 'production');
      if (productionEnv) {
        try {
          await deleteEnvironment(projectId, 'production');
        } catch (_error) {
          // Ignore if already deleted
        }
      }

      await setProgressComplete('railway', 'renameProductionEnv');
      await onStepComplete?.();

      // Refresh environments after changes
      environments = await getProjectEnvironments(projectId);
      prodEnv = environments.find((env) => env.name === 'prod');
    }

    // Step 3b: Create "staging" environment
    if (!(await isProgressComplete('railway', 'createStagingEnv'))) {
      // Create staging if it doesn't exist
      if (!stagingEnv) {
        try {
          // Create staging duplicated from prod if prod exists
          stagingEnv = await createEnvironment(projectId, 'staging', prodEnv?.id);

          // Store staging environment ID in config
          await updateConfigField('railway', 'stagingEnvironmentId', stagingEnv.id);

          // Store in Infisical for reference
          setSecret(infisicalProjectId, 'root', 'RAILWAY_STAGING_ENVIRONMENT_ID', stagingEnv.id);
        } catch (_error) {
          // Ignore if already exists
        }
      } else {
        // Staging exists, store its ID
        await updateConfigField('railway', 'stagingEnvironmentId', stagingEnv.id);
        setSecret(infisicalProjectId, 'root', 'RAILWAY_STAGING_ENVIRONMENT_ID', stagingEnv.id);
      }

      await setProgressComplete('railway', 'createStagingEnv');
      await onStepComplete?.();

      // Refresh environments after changes
      environments = await getProjectEnvironments(projectId);
      stagingEnv = environments.find((env) => env.name === 'staging');
    }

    // Verify we have both environments
    if (!prodEnv) {
      throw new Error('Prod environment not found. Check Railway dashboard and retry.');
    }
    if (!stagingEnv) {
      throw new Error('Staging environment not found. Check Railway dashboard and retry.');
    }

    // Step 4: Create Redis for prod environment
    if (!(await isProgressComplete('railway', 'createRedisProd'))) {
      if (!prodRedisServiceId) {
        const prodRedis = await retryWithTimeout(() => createRedis(projectId, prodEnv.id, prodEnv.name), {
          maxRetries: 100,
          delayMs: 3000,
          retryCondition: (error) => {
            const msg = error.message.toLowerCase();
            return msg.includes('provisioning') || msg.includes('deploying');
          },
          timeoutMessage: 'Prod Redis provisioning timed out after 5 minutes',
        });
        prodRedisServiceId = prodRedis.id;
        await updateConfigField('railway', 'prodRedisServiceId', prodRedisServiceId);

        // Get volume ID immediately after creation (before creating staging Redis)
        if (!prodRedisVolumeId) {
          const volume = await getServiceVolume(projectId, `${configProjectName}-prod-redis`);
          if (volume) {
            prodRedisVolumeId = volume.id;
            await updateConfigField('railway', 'prodRedisVolumeId', prodRedisVolumeId);
          }
        }
      }
      await setProgressComplete('railway', 'createRedisProd');
      await onStepComplete?.();
    }

    // Step 5: Rename prod Redis service
    if (!(await isProgressComplete('railway', 'renameRedisProd'))) {
      await renameService(prodRedisServiceId, `${configProjectName}-prod-redis`);
      await setProgressComplete('railway', 'renameRedisProd');
      await onStepComplete?.();
    }

    // Step 6: Rename prod Redis volume
    if (!(await isProgressComplete('railway', 'renameRedisProdVolume'))) {
      if (!prodRedisVolumeId) {
        const volume = await getServiceVolume(projectId, `${configProjectName}-prod-redis`);
        if (volume) {
          prodRedisVolumeId = volume.id;
          await updateConfigField('railway', 'prodRedisVolumeId', prodRedisVolumeId);
        }
      }
      if (prodRedisVolumeId) {
        await renameVolume(prodRedisVolumeId, `${configProjectName}-prod-redis-data`);
      }
      await setProgressComplete('railway', 'renameRedisProdVolume');
      await onStepComplete?.();
    }

    // Step 7: Create Redis for staging environment
    if (!(await isProgressComplete('railway', 'createRedisStaging'))) {
      if (!stagingRedisServiceId) {
        const stagingRedis = await retryWithTimeout(() => createRedis(projectId, stagingEnv.id, stagingEnv.name), {
          maxRetries: 100,
          delayMs: 3000,
          retryCondition: (error) => {
            const msg = error.message.toLowerCase();
            return msg.includes('provisioning') || msg.includes('deploying');
          },
          timeoutMessage: 'Staging Redis provisioning timed out after 5 minutes',
        });
        stagingRedisServiceId = stagingRedis.id;
        await updateConfigField('railway', 'stagingRedisServiceId', stagingRedisServiceId);

        // Get volume ID immediately after creation
        if (!stagingRedisVolumeId) {
          const volume = await getServiceVolume(projectId, `${configProjectName}-staging-redis`);
          if (volume) {
            stagingRedisVolumeId = volume.id;
            await updateConfigField('railway', 'stagingRedisVolumeId', stagingRedisVolumeId);
          }
        }
      }
      await setProgressComplete('railway', 'createRedisStaging');
      await onStepComplete?.();
    }

    // Step 8: Rename staging Redis service
    if (!(await isProgressComplete('railway', 'renameRedisStaging'))) {
      await renameService(stagingRedisServiceId, `${configProjectName}-staging-redis`);
      await setProgressComplete('railway', 'renameRedisStaging');
      await onStepComplete?.();
    }

    // Step 9: Rename staging Redis volume
    if (!(await isProgressComplete('railway', 'renameRedisStagingVolume'))) {
      if (!stagingRedisVolumeId) {
        const volume = await getServiceVolume(projectId, `${configProjectName}-staging-redis`);
        if (volume) {
          stagingRedisVolumeId = volume.id;
          await updateConfigField('railway', 'stagingRedisVolumeId', stagingRedisVolumeId);
        }
      }
      if (stagingRedisVolumeId) {
        await renameVolume(stagingRedisVolumeId, `${configProjectName}-staging-redis-data`);
      }
      await setProgressComplete('railway', 'renameRedisStagingVolume');
      await onStepComplete?.();
    }

    // Step 10: Store Redis URLs in Infisical (for both prod and staging)
    if (!(await isProgressComplete('railway', 'storeRedisUrl'))) {
      // Get Redis connection URLs (each environment has its own Redis instance).
      // Redis variables can lag briefly after provisioning, so retry until REDIS_URL is available.
      const prodRedisUrl = await retryWithTimeout(
        () => getRedisUrl(prodRedisServiceId, prodEnv.id, prodEnv.name, projectId),
        {
          maxRetries: 60,
          delayMs: 2000,
          retryCondition: (error) => error.message.toLowerCase().includes('redis_url not found'),
          timeoutMessage: 'Prod Redis URL not available after waiting 2 minutes',
        },
      );
      const stagingRedisUrl = await retryWithTimeout(
        () => getRedisUrl(stagingRedisServiceId, stagingEnv.id, stagingEnv.name, projectId),
        {
          maxRetries: 60,
          delayMs: 2000,
          retryCondition: (error) => error.message.toLowerCase().includes('redis_url not found'),
          timeoutMessage: 'Staging Redis URL not available after waiting 2 minutes',
        },
      );

      // Store in Infisical (/api path for API and Worker services)
      setSecret(infisicalProjectId, 'prod', 'REDIS_URL', prodRedisUrl, '/api');
      setSecret(infisicalProjectId, 'staging', 'REDIS_URL', stagingRedisUrl, '/api');

      await setProgressComplete('railway', 'storeRedisUrl');
      await onStepComplete?.();
    }

    // Step 11: Create Infisical Railway connection
    let connectionId = '';
    const getConnectionId = async (): Promise<string> => {
      if (connectionId) {
        return connectionId;
      }

      const railwayWorkspaceToken = await getRailwayWorkspaceToken();
      connectionId = await createRailwayConnection(
        infisicalProjectId,
        railwayWorkspaceToken,
        `${configProjectName}-railway`,
      );
      return connectionId;
    };

    const ensureServiceDeployment = async (serviceId: string, environmentId: string): Promise<void> => {
      const latestDeployment = await getLatestDeployment(serviceId, environmentId);
      if (!latestDeployment) {
        await triggerServiceDeployment(serviceId, environmentId);
      }
    };

    if (!(await isProgressComplete('railway', 'createInfisicalConnection'))) {
      connectionId = await getConnectionId();
      await setProgressComplete('railway', 'createInfisicalConnection');
      await onStepComplete?.();
    }

    // Check if we need to prompt for GitHub setup
    if (!(await isProgressComplete('railway', 'promptedForGithub'))) {
      // Exit here to show GitHub prompt in UI
      // User will resume after confirming
      throw new Error('GITHUB_SETUP_REQUIRED');
    }

    // Clear the GITHUB_SETUP_REQUIRED error if it was set
    await clearConfigError('railway');
    const githubRepo = `${config.project.organization}/${configProjectName}`;

    // Step 14: Create prod API service
    if (!(await isProgressComplete('railway', 'createApiProd'))) {
      if (!prodApiServiceId) {
        const prodApiService = await createService(projectId, prodEnv.id, 'prod', `${configProjectName}-prod-api`);
        prodApiServiceId = prodApiService.id;
        await updateConfigField('railway', 'prodApiServiceId', prodApiServiceId);
        setSecret(infisicalProjectId, 'root', 'RAILWAY_PROD_API_SERVICE_ID', prodApiServiceId);
      }
      await setProgressComplete('railway', 'createApiProd');
      await onStepComplete?.();
    }

    // Get connection ID once for all syncs
    const resolvedConnectionId = await getConnectionId();

    // Step 15: Ensure prod API service sync before GitHub connect
    if (!(await isProgressComplete('railway', 'createInfisicalSyncProd'))) {
      await ensureRailwaySync({
        infisicalProjectId,
        connectionId: resolvedConnectionId,
        syncName: `${configProjectName}-prod-api-service-sync`,
        infisicalEnvironment: 'prod',
        infisicalSecretPath: '/api',
        railwayProjectId: projectId,
        railwayProjectName: configProjectName,
        railwayEnvironmentId: prodEnv.id,
        railwayEnvironmentName: 'prod',
        railwayServiceId: prodApiServiceId,
        railwayServiceName: `${configProjectName}-prod-api`,
      });
      await setProgressComplete('railway', 'createInfisicalSyncProd');
      await onStepComplete?.();
    }

    // Step 16: Connect prod API to GitHub
    if (!(await isProgressComplete('railway', 'connectApiProdGithub'))) {
      try {
        await updateServiceInstanceConfig(prodApiServiceId, prodEnv.id, API_SERVICE_CONFIG);

        const isAlreadyConnected = await isServiceConnectedToGitHub(prodApiServiceId, prodEnv.id);
        if (!isAlreadyConnected) {
          await connectServiceToGitHub(prodApiServiceId, prodEnv.id, githubRepo, 'main');
        }

        // Verify GitHub connection succeeded
        const isConnected = await isServiceConnectedToGitHub(prodApiServiceId, prodEnv.id);

        if (!isConnected) {
          throw new Error(
            'GitHub connection failed. Please ensure:\n' +
              '  1. Railway GitHub App is installed on your GitHub account\n' +
              '  2. Railway has access to the repository: ' +
              config.project.organization +
              '/' +
              configProjectName +
              '\n' +
              '  3. Visit https://github.com/settings/installations to grant access',
          );
        }

        await ensureServiceDeployment(prodApiServiceId, prodEnv.id);
        await setProgressComplete('railway', 'connectApiProdGithub');
        await onStepComplete?.();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`\n⚠️  GITHUB CONNECTION FAILED`);
        console.warn(`   Service: prod API`);
        console.warn(`   Error: ${errorMsg}`);
        console.warn(`   Action: Grant Railway GitHub App access to your repository, then re-run setup\n`);

        // Don't mark as complete - will retry on resume
        throw error;
      }
    }

    // Step 16: Create staging API service
    if (!(await isProgressComplete('railway', 'createApiStaging'))) {
      if (!stagingApiServiceId) {
        const stagingApiService = await createService(
          projectId,
          stagingEnv.id,
          'staging',
          `${configProjectName}-staging-api`,
        );
        stagingApiServiceId = stagingApiService.id;
        await updateConfigField('railway', 'stagingApiServiceId', stagingApiServiceId);
        setSecret(infisicalProjectId, 'root', 'RAILWAY_STAGING_API_SERVICE_ID', stagingApiServiceId);
      }
      await setProgressComplete('railway', 'createApiStaging');
      await onStepComplete?.();
    }

    // Step 18: Ensure staging API service sync before GitHub connect
    if (!(await isProgressComplete('railway', 'createInfisicalSyncStagingApi'))) {
      await ensureRailwaySync({
        infisicalProjectId,
        connectionId: resolvedConnectionId,
        syncName: `${configProjectName}-staging-api-service-sync`,
        infisicalEnvironment: 'staging',
        infisicalSecretPath: '/api',
        railwayProjectId: projectId,
        railwayProjectName: configProjectName,
        railwayEnvironmentId: stagingEnv.id,
        railwayEnvironmentName: 'staging',
        railwayServiceId: stagingApiServiceId,
        railwayServiceName: `${configProjectName}-staging-api`,
      });
      await setProgressComplete('railway', 'createInfisicalSyncStagingApi');
      await onStepComplete?.();
    }

    // Step 19: Connect staging API to GitHub
    if (!(await isProgressComplete('railway', 'connectApiStagingGithub'))) {
      try {
        await updateServiceInstanceConfig(stagingApiServiceId, stagingEnv.id, API_SERVICE_CONFIG);

        const isAlreadyConnected = await isServiceConnectedToGitHub(stagingApiServiceId, stagingEnv.id);
        if (!isAlreadyConnected) {
          await connectServiceToGitHub(stagingApiServiceId, stagingEnv.id, githubRepo, 'main');
        }

        // Verify GitHub connection succeeded
        const isConnected = await isServiceConnectedToGitHub(stagingApiServiceId, stagingEnv.id);
        if (!isConnected) {
          throw new Error(
            'GitHub connection failed. Please ensure:\n' +
              '  1. Railway GitHub App is installed on your GitHub account\n' +
              '  2. Railway has access to the repository: ' +
              config.project.organization +
              '/' +
              configProjectName +
              '\n' +
              '  3. Visit https://github.com/settings/installations to grant access',
          );
        }

        await ensureServiceDeployment(stagingApiServiceId, stagingEnv.id);
        await setProgressComplete('railway', 'connectApiStagingGithub');
        await onStepComplete?.();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`\n⚠️  GITHUB CONNECTION FAILED`);
        console.warn(`   Service: staging API`);
        console.warn(`   Error: ${errorMsg}`);
        console.warn(`   Action: Grant Railway GitHub App access to your repository, then re-run setup\n`);
        // Don't mark as complete - will retry on resume
        throw error;
      }
    }

    // Step 18: Store API URLs in Infisical
    if (!(await isProgressComplete('railway', 'storeApiUrl'))) {
      // Store prod API URL
      const prodApiUrl = await getServiceDomain(prodApiServiceId, prodEnv.id);
      if (prodApiUrl) {
        setSecret(infisicalProjectId, 'prod', 'API_URL', prodApiUrl, '/');
      }

      // Store staging API URL
      const stagingApiUrl = await getServiceDomain(stagingApiServiceId, stagingEnv.id);
      if (stagingApiUrl) {
        setSecret(infisicalProjectId, 'staging', 'API_URL', stagingApiUrl, '/');
      }

      await setProgressComplete('railway', 'storeApiUrl');
      await onStepComplete?.();
    }

    // Step 20: Create prod Worker service
    if (!(await isProgressComplete('railway', 'createWorkerProd'))) {
      if (!prodWorkerServiceId) {
        const prodWorkerService = await createService(
          projectId,
          prodEnv.id,
          'prod',
          `${configProjectName}-prod-worker`,
        );
        prodWorkerServiceId = prodWorkerService.id;
        await updateConfigField('railway', 'prodWorkerServiceId', prodWorkerServiceId);
        setSecret(infisicalProjectId, 'root', 'RAILWAY_PROD_WORKER_SERVICE_ID', prodWorkerServiceId);
      }
      await setProgressComplete('railway', 'createWorkerProd');
      await onStepComplete?.();
    }

    // Step 21: Ensure prod Worker service sync before GitHub connect
    await ensureRailwaySync({
      infisicalProjectId,
      connectionId: resolvedConnectionId,
      syncName: `${configProjectName}-prod-worker-service-sync`,
      infisicalEnvironment: 'prod',
      infisicalSecretPath: '/api',
      railwayProjectId: projectId,
      railwayProjectName: configProjectName,
      railwayEnvironmentId: prodEnv.id,
      railwayEnvironmentName: 'prod',
      railwayServiceId: prodWorkerServiceId,
      railwayServiceName: `${configProjectName}-prod-worker`,
    });

    // Step 22: Connect prod Worker to GitHub
    if (!(await isProgressComplete('railway', 'connectWorkerProdGithub'))) {
      try {
        await updateServiceInstanceConfig(prodWorkerServiceId, prodEnv.id, WORKER_SERVICE_CONFIG);

        const isAlreadyConnected = await isServiceConnectedToGitHub(prodWorkerServiceId, prodEnv.id);
        if (!isAlreadyConnected) {
          await connectServiceToGitHub(prodWorkerServiceId, prodEnv.id, githubRepo, 'main');
        }

        // Verify GitHub connection succeeded
        const isConnected = await isServiceConnectedToGitHub(prodWorkerServiceId, prodEnv.id);
        if (!isConnected) {
          throw new Error(
            'GitHub connection failed. Please ensure:\n' +
              '  1. Railway GitHub App is installed on your GitHub account\n' +
              '  2. Railway has access to the repository: ' +
              config.project.organization +
              '/' +
              configProjectName +
              '\n' +
              '  3. Visit https://github.com/settings/installations to grant access',
          );
        }

        await ensureServiceDeployment(prodWorkerServiceId, prodEnv.id);
        await setProgressComplete('railway', 'connectWorkerProdGithub');
        await onStepComplete?.();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`\n⚠️  GITHUB CONNECTION FAILED`);
        console.warn(`   Service: prod Worker`);
        console.warn(`   Error: ${errorMsg}`);
        console.warn(`   Action: Grant Railway GitHub App access to your repository, then re-run setup\n`);
        // Don't mark as complete - will retry on resume
        throw error;
      }
    }

    // Step 23: Create staging Worker service
    if (!(await isProgressComplete('railway', 'createWorkerStaging'))) {
      if (!stagingWorkerServiceId) {
        const stagingWorkerService = await createService(
          projectId,
          stagingEnv.id,
          'staging',
          `${configProjectName}-staging-worker`,
        );
        stagingWorkerServiceId = stagingWorkerService.id;
        await updateConfigField('railway', 'stagingWorkerServiceId', stagingWorkerServiceId);
        setSecret(infisicalProjectId, 'root', 'RAILWAY_STAGING_WORKER_SERVICE_ID', stagingWorkerServiceId);
      }
      await setProgressComplete('railway', 'createWorkerStaging');
      await onStepComplete?.();
    }

    // Step 24: Ensure staging Worker service sync before GitHub connect
    if (!(await isProgressComplete('railway', 'createInfisicalSyncStagingWorker'))) {
      await ensureRailwaySync({
        infisicalProjectId,
        connectionId: resolvedConnectionId,
        syncName: `${configProjectName}-staging-worker-service-sync`,
        infisicalEnvironment: 'staging',
        infisicalSecretPath: '/api',
        railwayProjectId: projectId,
        railwayProjectName: configProjectName,
        railwayEnvironmentId: stagingEnv.id,
        railwayEnvironmentName: 'staging',
        railwayServiceId: stagingWorkerServiceId,
        railwayServiceName: `${configProjectName}-staging-worker`,
      });
      await setProgressComplete('railway', 'createInfisicalSyncStagingWorker');
      await onStepComplete?.();
    }

    // Step 25: Connect staging Worker to GitHub
    if (!(await isProgressComplete('railway', 'connectWorkerStagingGithub'))) {
      try {
        await updateServiceInstanceConfig(stagingWorkerServiceId, stagingEnv.id, WORKER_SERVICE_CONFIG);

        const isAlreadyConnected = await isServiceConnectedToGitHub(stagingWorkerServiceId, stagingEnv.id);
        if (!isAlreadyConnected) {
          await connectServiceToGitHub(stagingWorkerServiceId, stagingEnv.id, githubRepo, 'main');
        }

        // Verify GitHub connection succeeded
        const isConnected = await isServiceConnectedToGitHub(stagingWorkerServiceId, stagingEnv.id);
        if (!isConnected) {
          throw new Error(
            'GitHub connection failed. Please ensure:\n' +
              '  1. Railway GitHub App is installed on your GitHub account\n' +
              '  2. Railway has access to the repository: ' +
              config.project.organization +
              '/' +
              configProjectName +
              '\n' +
              '  3. Visit https://github.com/settings/installations to grant access',
          );
        }

        await ensureServiceDeployment(stagingWorkerServiceId, stagingEnv.id);
        await setProgressComplete('railway', 'connectWorkerStagingGithub');
        await onStepComplete?.();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`\n⚠️  GITHUB CONNECTION FAILED`);
        console.warn(`   Service: staging Worker`);
        console.warn(`   Error: ${errorMsg}`);
        console.warn(`   Action: Grant Railway GitHub App access to your repository, then re-run setup\n`);
        // Don't mark as complete - will retry on resume
        throw error;
      }
    }

    // Step 26: Mark setup complete
    if (!(await isProgressComplete('railway', 'verifyDeployment'))) {
      await ensureServiceDeployment(prodApiServiceId, prodEnv.id);
      await ensureServiceDeployment(stagingApiServiceId, stagingEnv.id);
      await ensureServiceDeployment(prodWorkerServiceId, prodEnv.id);
      await ensureServiceDeployment(stagingWorkerServiceId, stagingEnv.id);
      await setProgressComplete('railway', 'verifyDeployment');
      await onStepComplete?.();
    }

    // Fetch final URLs from Infisical (source of truth)
    const prodApiUrl = getSecret('API_URL', {
      projectId: infisicalProjectId,
      environment: 'prod',
      path: '/',
    });

    const stagingApiUrl = getSecret('API_URL', {
      projectId: infisicalProjectId,
      environment: 'staging',
      path: '/',
    });

    const prodRedisUrl = getSecret('REDIS_URL', {
      projectId: infisicalProjectId,
      environment: 'prod',
      path: '/api',
    });

    const stagingRedisUrl = getSecret('REDIS_URL', {
      projectId: infisicalProjectId,
      environment: 'staging',
      path: '/api',
    });

    return {
      projectId,
      prodApiServiceId,
      stagingApiServiceId,
      prodWorkerServiceId,
      stagingWorkerServiceId,
      prodRedisServiceId,
      stagingRedisServiceId,
      prodApiUrl,
      stagingApiUrl,
      prodRedisUrl,
      stagingRedisUrl,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    if (errorMsg !== 'GITHUB_SETUP_REQUIRED') {
      await setConfigError('railway', errorMsg);
    }
    throw error;
  }
};
