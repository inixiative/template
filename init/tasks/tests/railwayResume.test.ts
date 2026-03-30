import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { infisicalApi } from '../../api/infisical';
import { infisicalRailwayApi } from '../../api/infisicalRailway';
import { railwayApi } from '../../api/railway';
import { createMockConfig, defaultConfig } from '../../tests/mocks';
import type { ProjectConfig } from '../../utils/getProjectConfig';

const config = createMockConfig();

const cloneDefaultConfig = (): ProjectConfig => structuredClone(defaultConfig);
const liveProjectName = process.env.PROJECT_NAME ?? cloneDefaultConfig().project.name;
const liveWorkspaceId = process.env.RAILWAY_WORKSPACE_ID ?? 'workspace-123';
const liveProjectId = process.env.RAILWAY_PROJECT_ID ?? 'project-123';
const liveProdEnvironmentId = process.env.RAILWAY_PROD_ENVIRONMENT_ID ?? 'env-prod-123';
const liveStagingEnvironmentId = process.env.RAILWAY_STAGING_ENVIRONMENT_ID ?? 'env-staging-123';
const liveProdApiServiceId = process.env.RAILWAY_PROD_API_SERVICE_ID ?? 'api-prod-123';
const liveStagingApiServiceId = process.env.RAILWAY_STAGING_API_SERVICE_ID ?? 'api-staging-123';
const liveProdWorkerServiceId = process.env.RAILWAY_PROD_WORKER_SERVICE_ID ?? 'worker-prod-123';
const liveStagingWorkerServiceId = process.env.RAILWAY_STAGING_WORKER_SERVICE_ID ?? 'worker-staging-123';
const liveProdRedisServiceId = process.env.RAILWAY_PROD_REDIS_SERVICE_ID ?? 'redis-prod-123';
const liveStagingRedisServiceId = process.env.RAILWAY_STAGING_REDIS_SERVICE_ID ?? 'redis-staging-123';
const liveProdRedisVolumeId = process.env.RAILWAY_PROD_REDIS_VOLUME_ID ?? 'volume-prod-123';
const liveStagingRedisVolumeId = process.env.RAILWAY_STAGING_REDIS_VOLUME_ID ?? 'volume-staging-123';

const seedRailwayResumeState = (missingActions: string[]) => {
  config.setConfig({
    ...cloneDefaultConfig(),
    project: {
      ...cloneDefaultConfig().project,
      progress: {
        renameOrg: true,
        updatePackages: true,
        updateImports: true,
        updateReadme: true,
        updateTsconfigs: true,
        updateEnvFiles: true,
        cleanInstall: true,
        setup: true,
      },
    },
    infisical: {
      ...cloneDefaultConfig().infisical,
      projectId: process.env.INFISICAL_PROJECT_ID ?? 'infisical-proj-id-000',
    },
    railway: {
      ...cloneDefaultConfig().railway,
      workspaceId: liveWorkspaceId,
      projectId: liveProjectId,
      prodEnvironmentId: liveProdEnvironmentId,
      stagingEnvironmentId: liveStagingEnvironmentId,
      prodApiServiceId: liveProdApiServiceId,
      stagingApiServiceId: liveStagingApiServiceId,
      prodWorkerServiceId: liveProdWorkerServiceId,
      stagingWorkerServiceId: liveStagingWorkerServiceId,
      prodRedisServiceId: liveProdRedisServiceId,
      stagingRedisServiceId: liveStagingRedisServiceId,
      prodRedisVolumeId: liveProdRedisVolumeId,
      stagingRedisVolumeId: liveStagingRedisVolumeId,
      configProjectName: liveProjectName,
    },
  });

  config.markComplete(
    'railway',
    Object.keys(defaultConfig.railway.progress).filter((key) => !missingActions.includes(key)),
  );

  // getProjectEnvironments runs unconditionally (line 118 in railwaySetup.ts)
  railwayApi.vcr.queue('getProjectEnvironments', 'default');
};

/** Queue the 4 getSecret fixtures for the final return block in railwaySetup */
const queueFinalGetSecrets = () => {
  infisicalApi.vcr.queue('getSecret', 'prodApiUrl');
  infisicalApi.vcr.queue('getSecret', 'stagingApiUrl');
  infisicalApi.vcr.queue('getSecret', 'prodRedisUrl');
  infisicalApi.vcr.queue('getSecret', 'stagingRedisUrl');
};

config.install();

describe('Railway Resume Scenario', () => {
  beforeEach(() => {
    railwayApi.vcr.clear();
    infisicalApi.vcr.clear();
    infisicalRailwayApi.vcr.clear();
    config.clearAll();

    seedRailwayResumeState(['storeStagingRedisUrl']);
    railwayApi.vcr.queue('getRedisUrl', 'staging');
    // storeStagingRedisUrl step calls setSecretAsync
    infisicalApi.vcr.queue('setSecret', 'stagingRedisUrl');
    // getConnectionId() runs unconditionally at line 414 (resolvedConnectionId)
    railwayApi.vcr.queue('getRailwayWorkspaceToken', 'default');
    infisicalRailwayApi.vcr.queue('createRailwayConnection', 'default');
    // final return block: 4 getSecret calls
    queueFinalGetSecrets();
  });

  afterEach(() => {
    railwayApi.vcr.clear();
    infisicalApi.vcr.clear();
    infisicalRailwayApi.vcr.clear();
    config.clearAll();
  });

  test('resumes only the missing staging Redis URL step', async () => {
    const { setupRailway } = await import(`../railwaySetup?real=${Date.now()}`);

    const result = await setupRailway(liveWorkspaceId);

    expect(config.mocks.markComplete).toHaveBeenCalledWith('railway', 'storeStagingRedisUrl');
    expect(config.mocks.markComplete).not.toHaveBeenCalledWith('railway', 'storeProdRedisUrl');

    expect(result.prodRedisUrl).toEqual(expect.any(String));
    expect(result.stagingRedisUrl).toEqual(expect.any(String));

    // All VCR cassettes consumed
    expect(infisicalApi.vcr.isEmpty()).toBe(true);
  }, 60_000);

  test('resumes only the missing prod API deployment step', async () => {
    railwayApi.vcr.clear();
    infisicalApi.vcr.clear();
    infisicalRailwayApi.vcr.clear();
    config.clearAll();

    seedRailwayResumeState(['ensureProdApiDeployment']);
    // getConnectionId() runs before ensureProdApiDeployment in the code flow
    railwayApi.vcr.queue('getRailwayWorkspaceToken', 'default');
    infisicalRailwayApi.vcr.queue('createRailwayConnection', 'default');
    railwayApi.vcr.queue('getLatestDeployment', 'null');
    railwayApi.vcr.queue('triggerServiceDeployment', 'default');
    // final return block: 4 getSecret calls
    queueFinalGetSecrets();

    const { setupRailway } = await import(`../railwaySetup?real=${Date.now()}`);

    const result = await setupRailway(liveWorkspaceId);

    expect(config.mocks.markComplete).toHaveBeenCalledWith('railway', 'ensureProdApiDeployment');
    expect(config.mocks.markComplete).not.toHaveBeenCalledWith('railway', 'ensureStagingApiDeployment');

    expect(result.prodApiUrl).toEqual(expect.any(String));
    expect(result.stagingApiUrl).toEqual(expect.any(String));

    // All VCR cassettes consumed — no setSecret calls happened
    expect(infisicalApi.vcr.isEmpty()).toBe(true);
  }, 60_000);
});
