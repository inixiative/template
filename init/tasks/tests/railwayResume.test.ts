import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { railwayApi } from '../../api/railway';
import { createMockConfig, createMockInfisical, defaultConfig } from '../../tests/mocks';
import type { ProjectConfig } from '../../utils/getProjectConfig';

const config = createMockConfig();
const infisical = createMockInfisical();

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

// infisicalRailway is not being refactored — keep as mock.module
mock.module('../../api/infisicalRailway', () => ({
  createRailwayConnection: mock(async () => 'connection-123'),
  ensureRailwaySync: mock(async () => {}),
}));

const seedRailwayResumeState = (missingActions: string[]) => {
  config.setConfig({
    ...cloneDefaultConfig(),
    project: {
      ...cloneDefaultConfig().project,
      progress: {
        renameOrg: true,
        renameProject: true,
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

  infisical.seed([
    { key: 'API_URL', environment: 'prod', path: '/', value: 'https://prod.example.com' },
    { key: 'API_URL', environment: 'staging', path: '/', value: 'https://staging.example.com' },
    { key: 'REDIS_URL', environment: 'prod', path: '/api', value: 'redis://prod.example.com:6379' },
    { key: 'REDIS_URL', environment: 'staging', path: '/api', value: 'redis://staging.example.com:6379' },
  ]);

  // getProjectEnvironments runs unconditionally (line 118 in railwaySetup.ts)
  railwayApi.vcr.queue('getProjectEnvironments', 'default');
};

config.install();
infisical.install();

describe('Railway Resume Scenario', () => {
  beforeEach(() => {
    railwayApi.vcr.clear();
    config.clearAll();
    infisical.clearAll();

    seedRailwayResumeState(['storeStagingRedisUrl']);
    railwayApi.vcr.queue('getRedisUrl', 'staging');
    // getConnectionId() runs unconditionally at line 414 (resolvedConnectionId)
    railwayApi.vcr.queue('getRailwayWorkspaceToken', 'default');
  });

  afterEach(() => {
    railwayApi.vcr.clear();
    config.clearAll();
    infisical.clearAll();
  });

  test('resumes only the missing staging Redis URL step', async () => {
    const { setupRailway } = await import(`../railwaySetup?real=${Date.now()}`);

    const result = await setupRailway(liveWorkspaceId);

    expect(infisical.mocks.setSecretAsync).toHaveBeenCalledTimes(1);
    expect(infisical.mocks.setSecretAsync).toHaveBeenCalledWith(
      'infisical-proj-id-000',
      'staging',
      'REDIS_URL',
      expect.any(String),
      '/api',
    );

    expect(config.mocks.setProgressComplete).toHaveBeenCalledWith('railway', 'storeStagingRedisUrl');
    expect(config.mocks.setProgressComplete).not.toHaveBeenCalledWith('railway', 'storeProdRedisUrl');

    expect(result.prodRedisUrl).toBe('redis://prod.example.com:6379');
    expect(result.stagingRedisUrl).toEqual(expect.any(String));
  });

  test('resumes only the missing prod API deployment step', async () => {
    railwayApi.vcr.clear();
    config.clearAll();
    infisical.clearAll();

    seedRailwayResumeState(['ensureProdApiDeployment']);
    // getConnectionId() runs before ensureProdApiDeployment in the code flow
    railwayApi.vcr.queue('getRailwayWorkspaceToken', 'default');
    railwayApi.vcr.queue('getLatestDeployment', 'null');
    railwayApi.vcr.queue('triggerServiceDeployment', 'default');

    const { setupRailway } = await import(`../railwaySetup?real=${Date.now()}`);

    const result = await setupRailway(liveWorkspaceId);

    expect(config.mocks.setProgressComplete).toHaveBeenCalledWith('railway', 'ensureProdApiDeployment');
    expect(config.mocks.setProgressComplete).not.toHaveBeenCalledWith('railway', 'ensureStagingApiDeployment');

    expect(infisical.mocks.setSecretAsync).not.toHaveBeenCalled();

    expect(result.prodApiUrl).toBe('https://prod.example.com');
    expect(result.stagingApiUrl).toBe('https://staging.example.com');
  });
});
