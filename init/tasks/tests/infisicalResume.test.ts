import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { infisicalApi } from '../../api/infisical';
import { createMockConfig, createMockSystem, defaultConfig } from '../../tests/mocks';
import type { ProjectConfig } from '../../utils/getProjectConfig';

const config = createMockConfig();
const system = createMockSystem();

const cloneDefaultConfig = (): ProjectConfig => structuredClone(defaultConfig);
const liveProjectId = process.env.INFISICAL_PROJECT_ID ?? 'workspace-123';
const liveOrganizationId = process.env.INFISICAL_ORG_ID ?? 'org-123';

config.install();
system.install();

describe('Infisical Resume Scenario', () => {
  beforeEach(() => {
    infisicalApi.vcr.clear();
    config.clearAll();
    system.clearAll();

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
        projectId: liveProjectId,
        organizationId: liveOrganizationId,
        organizationSlug: 'template-org',
        projectSlug: 'template',
        configProjectName: cloneDefaultConfig().project.name,
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

    // renameEnv not complete → getProject + updateEnvironment
    infisicalApi.vcr.queue('getProject', 'withDevEnv');
    infisicalApi.vcr.queue('updateEnvironment', 'root');
    // createStagingAdminEnvImport not complete → createSecretImport
    infisicalApi.vcr.queue('createSecretImport', 'stagingAdmin');
  });

  afterEach(() => {
    infisicalApi.vcr.clear();
    config.clearAll();
    system.clearAll();
  });

  test('resumes only the missing rename/import steps and skips completed auth secrets', async () => {
    const { setupInfisical } = await import(`../infisicalSetup?real=${Date.now()}`);

    await setupInfisical('org-123');

    // createFolder not called — if it were, VCR would throw (no cassette queued)

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
