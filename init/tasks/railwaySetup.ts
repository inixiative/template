import { createRailwayConnection, ensureRailwaySync } from '../api/infisicalRailway';
import { railwayApi } from '../api/railway';
import { updateConfigField } from '../utils/configHelpers';
import { getProjectConfig } from '../utils/getProjectConfig';
import { clearError, clearProgress, isComplete, markComplete, setError } from '../utils/progressTracking';
import { retryWithTimeout } from '../utils/retry';
import { getSecretAsync, setSecretAsync } from './infisicalSetup';

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
    await clearError('railway');

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
      await clearProgress('railway');
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
    if (!(await isComplete('railway', 'selectWorkspace'))) {
      workspaceId = selectedWorkspaceId;
      await updateConfigField('railway', 'workspaceId', workspaceId);
      await updateConfigField('railway', 'configProjectName', configProjectName);
      await markComplete('railway', 'selectWorkspace');
      await onStepComplete?.();
    } else if (!workspaceId && selectedWorkspaceId) {
      // Re-store workspaceId if it was cleared but step is already complete
      workspaceId = selectedWorkspaceId;
      await updateConfigField('railway', 'workspaceId', workspaceId);
    }

    // Step 2: Store Railway user token in Infisical
    if (!(await isComplete('railway', 'storeRailwayToken'))) {
      await railwayApi.getRailwayUserToken(); // This will upload to Infisical if not already there
      await markComplete('railway', 'storeRailwayToken');
      await onStepComplete?.();
    }

    // Step 3: Create Railway project
    if (!(await isComplete('railway', 'createProject'))) {
      const project = await railwayApi.createProject(workspaceId, configProjectName);
      projectId = project.id;

      await updateConfigField('railway', 'projectId', projectId);
      await markComplete('railway', 'createProject');
      await onStepComplete?.();
    }

    // Get existing environments first to check what needs to be created
    let environments = await railwayApi.getProjectEnvironments(projectId);
    let prodEnv = environments.find((env) => env.name === 'prod');
    let stagingEnv = environments.find((env) => env.name === 'staging');

    // Step 3a: Ensure "prod" environment exists
    if (!(await isComplete('railway', 'ensureProdEnvironment'))) {
      if (!prodEnv) {
        try {
          prodEnv = await railwayApi.createEnvironment(projectId, 'prod');
        } catch (_error) {
          environments = await railwayApi.getProjectEnvironments(projectId);
          prodEnv = environments.find((env) => env.name === 'prod');
        }
      }

      if (!prodEnv) {
        throw new Error('Prod environment not found. Check Railway dashboard and retry.');
      }

      await updateConfigField('railway', 'prodEnvironmentId', prodEnv.id);
      await markComplete('railway', 'ensureProdEnvironment');
      await onStepComplete?.();
    }

    // Step 3b: Store prod environment ID in Infisical
    if (!(await isComplete('railway', 'storeProdEnvironmentIdSecret'))) {
      if (!prodEnv) {
        throw new Error('Prod environment not found. Check Railway dashboard and retry.');
      }

      await setSecretAsync(infisicalProjectId, 'root', 'RAILWAY_PROD_ENVIRONMENT_ID', prodEnv.id);
      await markComplete('railway', 'storeProdEnvironmentIdSecret');
      await onStepComplete?.();
    }

    // Step 3c: Delete legacy "production" environment
    if (!(await isComplete('railway', 'deleteLegacyProductionEnvironment'))) {
      const productionEnv = environments.find((env) => env.name === 'production');
      if (productionEnv) {
        try {
          await railwayApi.deleteEnvironment(projectId, 'production');
        } catch (_error) {
          // Ignore if already deleted
        }
      }

      await markComplete('railway', 'deleteLegacyProductionEnvironment');
      await onStepComplete?.();

      environments = await railwayApi.getProjectEnvironments(projectId);
      prodEnv = environments.find((env) => env.name === 'prod');
      stagingEnv = environments.find((env) => env.name === 'staging');
    }

    // Step 3d: Ensure "staging" environment exists
    if (!(await isComplete('railway', 'ensureStagingEnvironment'))) {
      if (!stagingEnv) {
        try {
          stagingEnv = await railwayApi.createEnvironment(projectId, 'staging', prodEnv?.id);
        } catch (_error) {
          environments = await railwayApi.getProjectEnvironments(projectId);
          stagingEnv = environments.find((env) => env.name === 'staging');
        }
      }

      if (!stagingEnv) {
        throw new Error('Staging environment not found. Check Railway dashboard and retry.');
      }

      await updateConfigField('railway', 'stagingEnvironmentId', stagingEnv.id);
      await markComplete('railway', 'ensureStagingEnvironment');
      await onStepComplete?.();
    }

    // Step 3e: Store staging environment ID in Infisical
    if (!(await isComplete('railway', 'storeStagingEnvironmentIdSecret'))) {
      if (!stagingEnv) {
        throw new Error('Staging environment not found. Check Railway dashboard and retry.');
      }

      await setSecretAsync(infisicalProjectId, 'root', 'RAILWAY_STAGING_ENVIRONMENT_ID', stagingEnv.id);
      await markComplete('railway', 'storeStagingEnvironmentIdSecret');
      await onStepComplete?.();
    }

    // Verify we have both environments
    if (!prodEnv) {
      throw new Error('Prod environment not found. Check Railway dashboard and retry.');
    }
    if (!stagingEnv) {
      throw new Error('Staging environment not found. Check Railway dashboard and retry.');
    }

    // Step 4: Ensure prod Redis service exists
    if (!(await isComplete('railway', 'ensureProdRedisService'))) {
      if (!prodRedisServiceId) {
        const prodRedis = await retryWithTimeout(() => railwayApi.createRedis(projectId, prodEnv.id, prodEnv.name), {
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
      }
      await markComplete('railway', 'ensureProdRedisService');
      await onStepComplete?.();
    }

    // Step 5: Capture prod Redis volume ID
    if (!(await isComplete('railway', 'captureProdRedisVolume'))) {
      if (!prodRedisVolumeId) {
        const volume = await railwayApi.getServiceVolume(projectId, `${configProjectName}-prod-redis`);
        if (!volume) {
          throw new Error('Prod Redis volume not found yet. Retry once Railway finishes provisioning.');
        }

        prodRedisVolumeId = volume.id;
        await updateConfigField('railway', 'prodRedisVolumeId', prodRedisVolumeId);
      }
      await markComplete('railway', 'captureProdRedisVolume');
      await onStepComplete?.();
    }

    // Step 6: Rename prod Redis service
    if (!(await isComplete('railway', 'renameProdRedisService'))) {
      if (!prodRedisServiceId) {
        throw new Error('Prod Redis service not found. Retry Railway setup.');
      }

      await railwayApi.renameService(prodRedisServiceId, `${configProjectName}-prod-redis`);
      await markComplete('railway', 'renameProdRedisService');
      await onStepComplete?.();
    }

    // Step 7: Rename prod Redis volume
    if (!(await isComplete('railway', 'renameProdRedisVolume'))) {
      if (!prodRedisVolumeId) {
        throw new Error('Prod Redis volume not found. Retry Railway setup.');
      }

      await railwayApi.renameVolume(prodRedisVolumeId, `${configProjectName}-prod-redis-data`);
      await markComplete('railway', 'renameProdRedisVolume');
      await onStepComplete?.();
    }

    // Step 8: Ensure staging Redis service exists
    if (!(await isComplete('railway', 'ensureStagingRedisService'))) {
      if (!stagingRedisServiceId) {
        const stagingRedis = await retryWithTimeout(
          () => railwayApi.createRedis(projectId, stagingEnv.id, stagingEnv.name),
          {
            maxRetries: 100,
            delayMs: 3000,
            retryCondition: (error) => {
              const msg = error.message.toLowerCase();
              return msg.includes('provisioning') || msg.includes('deploying');
            },
            timeoutMessage: 'Staging Redis provisioning timed out after 5 minutes',
          },
        );
        stagingRedisServiceId = stagingRedis.id;
        await updateConfigField('railway', 'stagingRedisServiceId', stagingRedisServiceId);
      }
      await markComplete('railway', 'ensureStagingRedisService');
      await onStepComplete?.();
    }

    // Step 9: Capture staging Redis volume ID
    if (!(await isComplete('railway', 'captureStagingRedisVolume'))) {
      if (!stagingRedisVolumeId) {
        const volume = await railwayApi.getServiceVolume(projectId, `${configProjectName}-staging-redis`);
        if (!volume) {
          throw new Error('Staging Redis volume not found yet. Retry once Railway finishes provisioning.');
        }

        stagingRedisVolumeId = volume.id;
        await updateConfigField('railway', 'stagingRedisVolumeId', stagingRedisVolumeId);
      }
      await markComplete('railway', 'captureStagingRedisVolume');
      await onStepComplete?.();
    }

    // Step 10: Rename staging Redis service
    if (!(await isComplete('railway', 'renameStagingRedisService'))) {
      if (!stagingRedisServiceId) {
        throw new Error('Staging Redis service not found. Retry Railway setup.');
      }

      await railwayApi.renameService(stagingRedisServiceId, `${configProjectName}-staging-redis`);
      await markComplete('railway', 'renameStagingRedisService');
      await onStepComplete?.();
    }

    // Step 11: Rename staging Redis volume
    if (!(await isComplete('railway', 'renameStagingRedisVolume'))) {
      if (!stagingRedisVolumeId) {
        throw new Error('Staging Redis volume not found. Retry Railway setup.');
      }

      await railwayApi.renameVolume(stagingRedisVolumeId, `${configProjectName}-staging-redis-data`);
      await markComplete('railway', 'renameStagingRedisVolume');
      await onStepComplete?.();
    }

    // Step 12: Store prod Redis URL in Infisical
    if (!(await isComplete('railway', 'storeProdRedisUrl'))) {
      const prodRedisUrl = await retryWithTimeout(
        () => railwayApi.getRedisUrl(prodRedisServiceId, prodEnv.id, prodEnv.name, projectId),
        {
          maxRetries: 60,
          delayMs: 2000,
          retryCondition: (error) => error.message.toLowerCase().includes('redis_url not found'),
          timeoutMessage: 'Prod Redis URL not available after waiting 2 minutes',
        },
      );
      await setSecretAsync(infisicalProjectId, 'prod', 'REDIS_URL', prodRedisUrl, '/api');
      await markComplete('railway', 'storeProdRedisUrl');
      await onStepComplete?.();
    }

    // Step 13: Store staging Redis URL in Infisical
    if (!(await isComplete('railway', 'storeStagingRedisUrl'))) {
      const stagingRedisUrl = await retryWithTimeout(
        () => railwayApi.getRedisUrl(stagingRedisServiceId, stagingEnv.id, stagingEnv.name, projectId),
        {
          maxRetries: 60,
          delayMs: 2000,
          retryCondition: (error) => error.message.toLowerCase().includes('redis_url not found'),
          timeoutMessage: 'Staging Redis URL not available after waiting 2 minutes',
        },
      );
      await setSecretAsync(infisicalProjectId, 'staging', 'REDIS_URL', stagingRedisUrl, '/api');
      await markComplete('railway', 'storeStagingRedisUrl');
      await onStepComplete?.();
    }

    // Step 11: Create Infisical Railway connection
    let connectionId = '';
    const getConnectionId = async (): Promise<string> => {
      if (connectionId) {
        return connectionId;
      }

      const railwayWorkspaceToken = await railwayApi.getRailwayWorkspaceToken();
      connectionId = await createRailwayConnection(
        infisicalProjectId,
        railwayWorkspaceToken,
        `${configProjectName}-railway`,
      );
      return connectionId;
    };

    const ensureServiceDeployment = async (serviceId: string, environmentId: string): Promise<void> => {
      const latestDeployment = await railwayApi.getLatestDeployment(serviceId, environmentId);
      if (!latestDeployment) {
        await railwayApi.triggerServiceDeployment(serviceId, environmentId);
      }
    };

    if (!(await isComplete('railway', 'createInfisicalConnection'))) {
      connectionId = await getConnectionId();
      await markComplete('railway', 'createInfisicalConnection');
      await onStepComplete?.();
    }

    // Check if we need to prompt for GitHub setup
    if (!(await isComplete('railway', 'promptedForGithub'))) {
      // Exit here to show GitHub prompt in UI
      // User will resume after confirming
      throw new Error('GITHUB_SETUP_REQUIRED');
    }

    // Clear the GITHUB_SETUP_REQUIRED error if it was set
    await clearError('railway');
    const githubRepo = `${config.project.organization}/${configProjectName}`;

    // Step 14: Ensure prod API service exists
    if (!(await isComplete('railway', 'ensureProdApiService'))) {
      if (!prodApiServiceId) {
        const prodApiService = await railwayApi.createService(
          projectId,
          prodEnv.id,
          'prod',
          `${configProjectName}-prod-api`,
        );
        prodApiServiceId = prodApiService.id;
        await updateConfigField('railway', 'prodApiServiceId', prodApiServiceId);
      }
      await markComplete('railway', 'ensureProdApiService');
      await onStepComplete?.();
    }

    // Step 15: Store prod API service ID in Infisical
    if (!(await isComplete('railway', 'storeProdApiServiceIdSecret'))) {
      await setSecretAsync(infisicalProjectId, 'root', 'RAILWAY_PROD_API_SERVICE_ID', prodApiServiceId);
      await markComplete('railway', 'storeProdApiServiceIdSecret');
      await onStepComplete?.();
    }

    // Get connection ID once for all syncs
    const resolvedConnectionId = await getConnectionId();

    // Step 16: Ensure prod API service sync before GitHub connect
    if (!(await isComplete('railway', 'createInfisicalSyncProd'))) {
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
      await markComplete('railway', 'createInfisicalSyncProd');
      await onStepComplete?.();
    }

    // Step 17: Configure prod API service instance
    if (!(await isComplete('railway', 'configureProdApiService'))) {
      await railwayApi.updateServiceInstanceConfig(prodApiServiceId, prodEnv.id, API_SERVICE_CONFIG);
      await markComplete('railway', 'configureProdApiService');
      await onStepComplete?.();
    }

    // Step 18: Connect prod API to GitHub
    if (!(await isComplete('railway', 'connectProdApiGithub'))) {
      try {
        const isAlreadyConnected = await railwayApi.isServiceConnectedToGitHub(prodApiServiceId, prodEnv.id);
        if (!isAlreadyConnected) {
          await railwayApi.connectServiceToGitHub(prodApiServiceId, prodEnv.id, githubRepo, 'main');
        }

        // Verify GitHub connection succeeded
        const isConnected = await railwayApi.isServiceConnectedToGitHub(prodApiServiceId, prodEnv.id);

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

        await markComplete('railway', 'connectProdApiGithub');
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

    // Step 19: Ensure prod API deployment exists
    if (!(await isComplete('railway', 'ensureProdApiDeployment'))) {
      await ensureServiceDeployment(prodApiServiceId, prodEnv.id);
      await markComplete('railway', 'ensureProdApiDeployment');
      await onStepComplete?.();
    }

    // Step 20: Ensure staging API service exists
    if (!(await isComplete('railway', 'ensureStagingApiService'))) {
      if (!stagingApiServiceId) {
        const stagingApiService = await railwayApi.createService(
          projectId,
          stagingEnv.id,
          'staging',
          `${configProjectName}-staging-api`,
        );
        stagingApiServiceId = stagingApiService.id;
        await updateConfigField('railway', 'stagingApiServiceId', stagingApiServiceId);
      }
      await markComplete('railway', 'ensureStagingApiService');
      await onStepComplete?.();
    }

    // Step 21: Store staging API service ID in Infisical
    if (!(await isComplete('railway', 'storeStagingApiServiceIdSecret'))) {
      await setSecretAsync(infisicalProjectId, 'root', 'RAILWAY_STAGING_API_SERVICE_ID', stagingApiServiceId);
      await markComplete('railway', 'storeStagingApiServiceIdSecret');
      await onStepComplete?.();
    }

    // Step 22: Ensure staging API service sync before GitHub connect
    if (!(await isComplete('railway', 'createInfisicalSyncStagingApi'))) {
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
      await markComplete('railway', 'createInfisicalSyncStagingApi');
      await onStepComplete?.();
    }

    // Step 23: Configure staging API service instance
    if (!(await isComplete('railway', 'configureStagingApiService'))) {
      await railwayApi.updateServiceInstanceConfig(stagingApiServiceId, stagingEnv.id, API_SERVICE_CONFIG);
      await markComplete('railway', 'configureStagingApiService');
      await onStepComplete?.();
    }

    // Step 24: Connect staging API to GitHub
    if (!(await isComplete('railway', 'connectStagingApiGithub'))) {
      try {
        const isAlreadyConnected = await railwayApi.isServiceConnectedToGitHub(stagingApiServiceId, stagingEnv.id);
        if (!isAlreadyConnected) {
          await railwayApi.connectServiceToGitHub(stagingApiServiceId, stagingEnv.id, githubRepo, 'main');
        }

        // Verify GitHub connection succeeded
        const isConnected = await railwayApi.isServiceConnectedToGitHub(stagingApiServiceId, stagingEnv.id);
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

        await markComplete('railway', 'connectStagingApiGithub');
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

    // Step 25: Ensure staging API deployment exists
    if (!(await isComplete('railway', 'ensureStagingApiDeployment'))) {
      await ensureServiceDeployment(stagingApiServiceId, stagingEnv.id);
      await markComplete('railway', 'ensureStagingApiDeployment');
      await onStepComplete?.();
    }

    // Step 26: Store prod API URL in Infisical (creates domain if needed)
    if (!(await isComplete('railway', 'storeProdApiUrl'))) {
      await onStepComplete?.('Ensuring prod API domain...');
      const prodApiUrl = await railwayApi.ensureServiceDomain(prodApiServiceId, prodEnv.id);
      await setSecretAsync(infisicalProjectId, 'prod', 'API_URL', prodApiUrl, '/');
      await setSecretAsync(infisicalProjectId, 'prod', 'VITE_API_URL', prodApiUrl, '/');
      await markComplete('railway', 'storeProdApiUrl');
      await onStepComplete?.();
    }

    // Step 27: Store staging API URL in Infisical (creates domain if needed)
    if (!(await isComplete('railway', 'storeStagingApiUrl'))) {
      await onStepComplete?.('Ensuring staging API domain...');
      const stagingApiUrl = await railwayApi.ensureServiceDomain(stagingApiServiceId, stagingEnv.id);
      await setSecretAsync(infisicalProjectId, 'staging', 'API_URL', stagingApiUrl, '/');
      await setSecretAsync(infisicalProjectId, 'staging', 'VITE_API_URL', stagingApiUrl, '/');
      await markComplete('railway', 'storeStagingApiUrl');
      await onStepComplete?.();
    }

    // Step 28: Ensure prod Worker service exists
    if (!(await isComplete('railway', 'ensureProdWorkerService'))) {
      if (!prodWorkerServiceId) {
        const prodWorkerService = await railwayApi.createService(
          projectId,
          prodEnv.id,
          'prod',
          `${configProjectName}-prod-worker`,
        );
        prodWorkerServiceId = prodWorkerService.id;
        await updateConfigField('railway', 'prodWorkerServiceId', prodWorkerServiceId);
      }
      await markComplete('railway', 'ensureProdWorkerService');
      await onStepComplete?.();
    }

    // Step 29: Store prod Worker service ID in Infisical
    if (!(await isComplete('railway', 'storeProdWorkerServiceIdSecret'))) {
      await setSecretAsync(infisicalProjectId, 'root', 'RAILWAY_PROD_WORKER_SERVICE_ID', prodWorkerServiceId);
      await markComplete('railway', 'storeProdWorkerServiceIdSecret');
      await onStepComplete?.();
    }

    // Step 30: Ensure prod Worker service sync before GitHub connect
    if (!(await isComplete('railway', 'createInfisicalSyncProdWorker'))) {
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
      await markComplete('railway', 'createInfisicalSyncProdWorker');
      await onStepComplete?.();
    }

    // Step 31: Configure prod Worker service instance
    if (!(await isComplete('railway', 'configureProdWorkerService'))) {
      await railwayApi.updateServiceInstanceConfig(prodWorkerServiceId, prodEnv.id, WORKER_SERVICE_CONFIG);
      await markComplete('railway', 'configureProdWorkerService');
      await onStepComplete?.();
    }

    // Step 32: Connect prod Worker to GitHub
    if (!(await isComplete('railway', 'connectProdWorkerGithub'))) {
      try {
        const isAlreadyConnected = await railwayApi.isServiceConnectedToGitHub(prodWorkerServiceId, prodEnv.id);
        if (!isAlreadyConnected) {
          await railwayApi.connectServiceToGitHub(prodWorkerServiceId, prodEnv.id, githubRepo, 'main');
        }

        // Verify GitHub connection succeeded
        const isConnected = await railwayApi.isServiceConnectedToGitHub(prodWorkerServiceId, prodEnv.id);
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

        await markComplete('railway', 'connectProdWorkerGithub');
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

    // Step 33: Ensure prod Worker deployment exists
    if (!(await isComplete('railway', 'ensureProdWorkerDeployment'))) {
      await ensureServiceDeployment(prodWorkerServiceId, prodEnv.id);
      await markComplete('railway', 'ensureProdWorkerDeployment');
      await onStepComplete?.();
    }

    // Step 34: Ensure staging Worker service exists
    if (!(await isComplete('railway', 'ensureStagingWorkerService'))) {
      if (!stagingWorkerServiceId) {
        const stagingWorkerService = await railwayApi.createService(
          projectId,
          stagingEnv.id,
          'staging',
          `${configProjectName}-staging-worker`,
        );
        stagingWorkerServiceId = stagingWorkerService.id;
        await updateConfigField('railway', 'stagingWorkerServiceId', stagingWorkerServiceId);
      }
      await markComplete('railway', 'ensureStagingWorkerService');
      await onStepComplete?.();
    }

    // Step 35: Store staging Worker service ID in Infisical
    if (!(await isComplete('railway', 'storeStagingWorkerServiceIdSecret'))) {
      await setSecretAsync(infisicalProjectId, 'root', 'RAILWAY_STAGING_WORKER_SERVICE_ID', stagingWorkerServiceId);
      await markComplete('railway', 'storeStagingWorkerServiceIdSecret');
      await onStepComplete?.();
    }

    // Step 36: Ensure staging Worker service sync before GitHub connect
    if (!(await isComplete('railway', 'createInfisicalSyncStagingWorker'))) {
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
      await markComplete('railway', 'createInfisicalSyncStagingWorker');
      await onStepComplete?.();
    }

    // Step 37: Configure staging Worker service instance
    if (!(await isComplete('railway', 'configureStagingWorkerService'))) {
      await railwayApi.updateServiceInstanceConfig(stagingWorkerServiceId, stagingEnv.id, WORKER_SERVICE_CONFIG);
      await markComplete('railway', 'configureStagingWorkerService');
      await onStepComplete?.();
    }

    // Step 38: Connect staging Worker to GitHub
    if (!(await isComplete('railway', 'connectStagingWorkerGithub'))) {
      try {
        const isAlreadyConnected = await railwayApi.isServiceConnectedToGitHub(stagingWorkerServiceId, stagingEnv.id);
        if (!isAlreadyConnected) {
          await railwayApi.connectServiceToGitHub(stagingWorkerServiceId, stagingEnv.id, githubRepo, 'main');
        }

        // Verify GitHub connection succeeded
        const isConnected = await railwayApi.isServiceConnectedToGitHub(stagingWorkerServiceId, stagingEnv.id);
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

        await markComplete('railway', 'connectStagingWorkerGithub');
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

    // Step 39: Ensure staging Worker deployment exists
    if (!(await isComplete('railway', 'ensureStagingWorkerDeployment'))) {
      await ensureServiceDeployment(stagingWorkerServiceId, stagingEnv.id);
      await markComplete('railway', 'ensureStagingWorkerDeployment');
      await onStepComplete?.();
    }

    // Fetch final URLs from Infisical (source of truth)
    const prodApiUrl = await getSecretAsync('API_URL', {
      projectId: infisicalProjectId,
      environment: 'prod',
      path: '/',
    });

    const stagingApiUrl = await getSecretAsync('API_URL', {
      projectId: infisicalProjectId,
      environment: 'staging',
      path: '/',
    });

    const prodRedisUrl = await getSecretAsync('REDIS_URL', {
      projectId: infisicalProjectId,
      environment: 'prod',
      path: '/api',
    });

    const stagingRedisUrl = await getSecretAsync('REDIS_URL', {
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
      await setError('railway', errorMsg);
    }
    throw error;
  }
};
