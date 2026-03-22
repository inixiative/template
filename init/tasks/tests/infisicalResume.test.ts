import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { createMockConfig, createMockSystem, defaultConfig, loadFixture, VCR } from '../../tests/mocks';
import type { ProjectConfig } from '../../utils/getProjectConfig';

const config = createMockConfig();
const system = createMockSystem();
const getProjectVcr = new VCR<unknown>();

const apiMocks = {
  createFolder: mock(async () => {}),
  createSecretImport: mock(async () => {}),
  getOrganization: mock(async () => ({ id: 'org-123', name: 'Template Org', slug: 'template-org' })),
  getProject: mock(async () => getProjectVcr.require()),
  updateEnvironment: mock(async () => {}),
  updateProjectSlug: mock(async () => {}),
  upsertProject: mock(async () => ({ id: 'workspace-123', name: 'template', slug: 'template' })),
  toInfisicalSlug: (name: string) => name.toLowerCase(),
};

const clearApiMocks = () => {
  apiMocks.createFolder.mockClear();
  apiMocks.createSecretImport.mockClear();
  apiMocks.getOrganization.mockClear();
  apiMocks.getProject.mockClear();
  apiMocks.updateEnvironment.mockClear();
  apiMocks.updateProjectSlug.mockClear();
  apiMocks.upsertProject.mockClear();
  getProjectVcr.clear();
};

const cloneDefaultConfig = (): ProjectConfig => structuredClone(defaultConfig);

config.install();
system.install();
mock.module('../../api/infisical', () => apiMocks);

describe('Infisical Resume Scenario', () => {
  beforeEach(() => {
    config.clearAll();
    system.clearAll();
    clearApiMocks();

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
        projectId: 'workspace-123',
        organizationId: 'org-123',
        organizationSlug: 'template-org',
        projectSlug: 'template',
        configProjectName: 'template',
      },
    });

    config.markComplete('infisical', [
      'selectOrg',
      'createProject',
      'createRootApiFolder',
      'createRootWebFolder',
      'createRootAdminFolder',
      'createRootSuperadminFolder',
      'createStagingApiFolder',
      'createStagingWebFolder',
      'createStagingAdminFolder',
      'createStagingSuperadminFolder',
      'createProdApiFolder',
      'createProdWebFolder',
      'createProdAdminFolder',
      'createProdSuperadminFolder',
      'createStagingApiRootImport',
      'createStagingApiRootAppImport',
      'createStagingApiEnvImport',
      'createStagingWebRootImport',
      'createStagingWebRootAppImport',
      'createStagingWebEnvImport',
      'createStagingAdminRootImport',
      'createStagingAdminRootAppImport',
      'createStagingSuperadminRootImport',
      'createStagingSuperadminRootAppImport',
      'createStagingSuperadminEnvImport',
      'createProdApiRootImport',
      'createProdApiRootAppImport',
      'createProdApiEnvImport',
      'createProdWebRootImport',
      'createProdWebRootAppImport',
      'createProdWebEnvImport',
      'createProdAdminRootImport',
      'createProdAdminRootAppImport',
      'createProdAdminEnvImport',
      'createProdSuperadminRootImport',
      'createProdSuperadminRootAppImport',
      'createProdSuperadminEnvImport',
      'ensureProdApiAuthSecret',
      'ensureStagingApiAuthSecret',
    ]);

    getProjectVcr.add(loadFixture('infisical/getProjectWithDevEnv'));
  });

  afterEach(() => {
    config.clearAll();
    system.clearAll();
    clearApiMocks();
  });

  test('resumes only the missing rename/import steps and skips completed auth secrets', async () => {
    const { setupInfisical } = await import(`../infisicalSetup?real=${Date.now()}`);

    await setupInfisical('org-123');

    expect(apiMocks.createFolder).not.toHaveBeenCalled();
    expect(apiMocks.updateEnvironment).toHaveBeenCalledWith('workspace-123', 'env-dev-123', {
      name: 'Root',
      slug: 'root',
    });

    expect(apiMocks.createSecretImport).toHaveBeenCalledTimes(1);
    expect(apiMocks.createSecretImport).toHaveBeenCalledWith('workspace-123', 'staging', '/admin', 'staging', '/');

    expect(config.mocks.setProgressComplete).toHaveBeenCalledWith('infisical', 'renameEnv');
    expect(config.mocks.setProgressComplete).toHaveBeenCalledWith('infisical', 'createStagingAdminEnvImport');
    expect(config.mocks.setProgressComplete).not.toHaveBeenCalledWith('infisical', 'ensureProdApiAuthSecret');
    expect(config.mocks.setProgressComplete).not.toHaveBeenCalledWith('infisical', 'ensureStagingApiAuthSecret');

    const authSecretCalls = system.mocks.exec.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('BETTER_AUTH_SECRET'),
    );
    expect(authSecretCalls).toHaveLength(0);
  });
});
