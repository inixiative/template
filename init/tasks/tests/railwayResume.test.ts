import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { createMockConfig, createMockInfisical, defaultConfig, loadFixture, VCR } from '../../tests/mocks';
import type { ProjectConfig } from '../../utils/getProjectConfig';

const config = createMockConfig();
const infisical = createMockInfisical();
const environmentsVcr = new VCR<Array<{ id: string; name: string }>>();
const deploymentVcr = new VCR<unknown | null>();
const redisUrlVcr = new VCR<string>();

const railwayApiMocks = {
  connectServiceToGitHub: mock(async () => {}),
  createEnvironment: mock(async () => ({ id: 'env-created', name: 'created' })),
  createProject: mock(async () => ({
    id: 'project-123',
    name: 'template',
    workspaceId: 'workspace-123',
    createdAt: '',
  })),
  createRedis: mock(async () => ({ id: 'redis-created', name: 'redis', projectId: 'project-123' })),
  createService: mock(async () => ({ id: 'service-created', name: 'service', projectId: 'project-123' })),
  deleteEnvironment: mock(async () => {}),
  getLatestDeployment: mock(async () => deploymentVcr.require()),
  getProjectEnvironments: mock(async () => environmentsVcr.require()),
  getRailwayUserToken: mock(async () => 'railway-user-token'),
  getRailwayWorkspaceToken: mock(async () => 'railway-workspace-token'),
  getRedisUrl: mock(async () => redisUrlVcr.require()),
  getServiceDomain: mock(async () => 'https://service.example.com'),
  getServiceVolume: mock(async () => ({ id: 'volume-created', name: 'volume' })),
  isServiceConnectedToGitHub: mock(async () => true),
  renameService: mock(async () => {}),
  renameVolume: mock(async () => {}),
  triggerServiceDeployment: mock(async () => {}),
  updateServiceInstanceConfig: mock(async () => {}),
};

const infisicalRailwayMocks = {
  createRailwayConnection: mock(async () => 'connection-123'),
  ensureRailwaySync: mock(async () => {}),
};

const clearRailwayApiMocks = () => {
  for (const fn of Object.values(railwayApiMocks)) {
    fn.mockClear();
  }
  environmentsVcr.clear();
  deploymentVcr.clear();
  redisUrlVcr.clear();
};

const clearInfisicalRailwayMocks = () => {
  infisicalRailwayMocks.createRailwayConnection.mockClear();
  infisicalRailwayMocks.ensureRailwaySync.mockClear();
};

const cloneDefaultConfig = (): ProjectConfig => structuredClone(defaultConfig);

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
      projectId: 'infisical-proj-id-000',
    },
    railway: {
      ...cloneDefaultConfig().railway,
      workspaceId: 'workspace-123',
      projectId: 'project-123',
      prodEnvironmentId: 'env-prod-123',
      stagingEnvironmentId: 'env-staging-123',
      prodApiServiceId: 'api-prod-123',
      stagingApiServiceId: 'api-staging-123',
      prodWorkerServiceId: 'worker-prod-123',
      stagingWorkerServiceId: 'worker-staging-123',
      prodRedisServiceId: 'redis-prod-123',
      stagingRedisServiceId: 'redis-staging-123',
      prodRedisVolumeId: 'volume-prod-123',
      stagingRedisVolumeId: 'volume-staging-123',
      configProjectName: 'template',
    },
  });

  config.markComplete(
    'railway',
    Object.keys(defaultConfig.railway.progress).filter((key) => !missingActions.includes(key)),
  );

  infisical.seed([
    {
      key: 'API_URL',
      environment: 'prod',
      path: '/',
      value: 'https://prod.example.com',
    },
    {
      key: 'API_URL',
      environment: 'staging',
      path: '/',
      value: 'https://staging.example.com',
    },
    {
      key: 'REDIS_URL',
      environment: 'prod',
      path: '/api',
      value: 'redis://prod.example.com:6379',
    },
    {
      key: 'REDIS_URL',
      environment: 'staging',
      path: '/api',
      value: 'redis://staging.example.com:6379',
    },
  ]);

  environmentsVcr.add(loadFixture<Array<{ id: string; name: string }>>('railway/projectEnvironments'));
};

config.install();
infisical.install();
mock.module('../../api/railway', () => railwayApiMocks);
mock.module('../../api/infisicalRailway', () => infisicalRailwayMocks);

describe('Railway Resume Scenario', () => {
  beforeEach(() => {
    config.clearAll();
    infisical.clearAll();
    clearRailwayApiMocks();
    clearInfisicalRailwayMocks();

    seedRailwayResumeState(['storeStagingRedisUrl']);
    redisUrlVcr.add(loadFixture<string>('railway/stagingRedisUrl'));
  });

  afterEach(() => {
    config.clearAll();
    infisical.clearAll();
    clearRailwayApiMocks();
    clearInfisicalRailwayMocks();
  });

  test('resumes only the missing staging Redis URL step', async () => {
    const { setupRailway } = await import(`../railwaySetup?real=${Date.now()}`);

    const result = await setupRailway('workspace-123');

    expect(railwayApiMocks.getProjectEnvironments).toHaveBeenCalledTimes(1);
    expect(railwayApiMocks.createEnvironment).not.toHaveBeenCalled();
    expect(railwayApiMocks.createRedis).not.toHaveBeenCalled();
    expect(railwayApiMocks.renameService).not.toHaveBeenCalled();
    expect(railwayApiMocks.renameVolume).not.toHaveBeenCalled();

    expect(railwayApiMocks.getRedisUrl).toHaveBeenCalledTimes(1);
    expect(railwayApiMocks.getRedisUrl).toHaveBeenCalledWith(
      'redis-staging-123',
      'env-staging-123',
      'staging',
      'project-123',
    );

    expect(infisical.mocks.setSecretAsync).toHaveBeenCalledTimes(1);
    expect(infisical.mocks.setSecretAsync).toHaveBeenCalledWith(
      'infisical-proj-id-000',
      'staging',
      'REDIS_URL',
      'redis://staging.example.com:6379',
      '/api',
    );

    expect(config.mocks.setProgressComplete).toHaveBeenCalledWith('railway', 'storeStagingRedisUrl');
    expect(config.mocks.setProgressComplete).not.toHaveBeenCalledWith('railway', 'storeProdRedisUrl');

    expect(result.prodRedisUrl).toBe('redis://prod.example.com:6379');
    expect(result.stagingRedisUrl).toBe('redis://staging.example.com:6379');
  });

  test('resumes only the missing prod API deployment step', async () => {
    config.clearAll();
    infisical.clearAll();
    clearRailwayApiMocks();
    clearInfisicalRailwayMocks();

    seedRailwayResumeState(['ensureProdApiDeployment']);
    deploymentVcr.add(loadFixture<null>('railway/noDeployment'));

    const { setupRailway } = await import(`../railwaySetup?real=${Date.now()}`);

    const result = await setupRailway('workspace-123');

    expect(railwayApiMocks.getLatestDeployment).toHaveBeenCalledTimes(1);
    expect(railwayApiMocks.getLatestDeployment).toHaveBeenCalledWith('api-prod-123', 'env-prod-123');
    expect(railwayApiMocks.triggerServiceDeployment).toHaveBeenCalledTimes(1);
    expect(railwayApiMocks.triggerServiceDeployment).toHaveBeenCalledWith('api-prod-123', 'env-prod-123');

    expect(railwayApiMocks.updateServiceInstanceConfig).not.toHaveBeenCalled();
    expect(railwayApiMocks.connectServiceToGitHub).not.toHaveBeenCalled();
    expect(railwayApiMocks.createService).not.toHaveBeenCalled();
    expect(infisical.mocks.setSecretAsync).not.toHaveBeenCalled();

    expect(config.mocks.setProgressComplete).toHaveBeenCalledWith('railway', 'ensureProdApiDeployment');
    expect(config.mocks.setProgressComplete).not.toHaveBeenCalledWith('railway', 'ensureStagingApiDeployment');

    expect(result.prodApiUrl).toBe('https://prod.example.com');
    expect(result.stagingApiUrl).toBe('https://staging.example.com');
  });
});
