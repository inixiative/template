import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { defaultConfig, loadFixture, VCR } from '../../tests/mocks';
import type { ProjectConfig } from '../../utils/getProjectConfig';

const connectionVcr = new VCR<string>();

const readFileMock = mock(async () => JSON.stringify({ token: 'vercel-token-from-file' }));
const getProjectConfigMock = mock(async () => currentConfig);
const updateConfigFieldMock = mock(async (section: string, field: string, value: string) => {
  (currentConfig[section as keyof ProjectConfig] as Record<string, unknown>)[field] = value;
});
const isCompleteMock = mock(async (_section: string, action: string) => completedActions.has(action));
const markCompleteMock = mock(async (_section: string, action: string) => {
  completedActions.add(action);
});
const setErrorMock = mock(async () => {});
const setSecretAsyncMock = mock(async () => {});
const createVercelConnectionMock = mock(async () => connectionVcr.require());
const ensureVercelSyncMock = mock(async () => {});
const isAppInstalledMock = mock(async () => true);
const checkGitHubIntegrationMock = mock(async () => ({}));
const createCustomEnvironmentMock = mock(async () => {});
const createProjectMock = mock(async () => ({ id: 'unused-project', name: 'unused', framework: null }));
const linkGitHubMock = mock(async () => {});
const updateProjectSettingsMock = mock(async () => {});

let currentConfig: ProjectConfig;
let completedActions = new Set<string>();

const cloneDefaultConfig = (): ProjectConfig => structuredClone(defaultConfig);

mock.module('node:fs/promises', () => ({
  readFile: readFileMock,
}));
mock.module('../../utils/getProjectConfig', () => ({
  getProjectConfig: getProjectConfigMock,
}));
mock.module('../../utils/configHelpers', () => ({
  updateConfigField: updateConfigFieldMock,
}));
mock.module('../../utils/progressTracking', () => ({
  isComplete: isCompleteMock,
  markComplete: markCompleteMock,
  setError: setErrorMock,
}));
mock.module('../../tasks/infisicalSetup', () => ({
  setSecretAsync: setSecretAsyncMock,
}));
mock.module('../../api/infisicalVercel', () => ({
  createVercelConnection: createVercelConnectionMock,
  ensureVercelSync: ensureVercelSyncMock,
}));
mock.module('../../api/github', () => ({
  isAppInstalled: isAppInstalledMock,
}));
mock.module('../../api/vercel', () => ({
  checkGitHubIntegration: checkGitHubIntegrationMock,
  createCustomEnvironment: createCustomEnvironmentMock,
  createProject: createProjectMock,
  linkGitHub: linkGitHubMock,
  updateProjectSettings: updateProjectSettingsMock,
}));

describe('Vercel Bootstrap Resume Scenario', () => {
  beforeEach(() => {
    currentConfig = {
      ...cloneDefaultConfig(),
      project: {
        ...cloneDefaultConfig().project,
        name: 'template',
        organization: 'inixiative',
      },
      infisical: {
        ...cloneDefaultConfig().infisical,
        projectId: 'infisical-proj-id-000',
      },
      vercel: {
        ...cloneDefaultConfig().vercel,
        teamId: 'team_123',
        teamName: 'Template Team',
        connectionId: '',
        webProjectId: 'web_proj_123',
        adminProjectId: 'admin_proj_123',
        superadminProjectId: 'superadmin_proj_123',
        configProjectName: 'template',
      },
    };
    completedActions = new Set(
      Object.keys(defaultConfig.vercel.progress).filter((action) => action !== 'createInfisicalConnection'),
    );
    connectionVcr.clear();
    connectionVcr.add(loadFixture<string>('vercel/connectionId'));

    readFileMock.mockClear();
    getProjectConfigMock.mockClear();
    updateConfigFieldMock.mockClear();
    isCompleteMock.mockClear();
    markCompleteMock.mockClear();
    setErrorMock.mockClear();
    setSecretAsyncMock.mockClear();
    createVercelConnectionMock.mockClear();
    ensureVercelSyncMock.mockClear();
    isAppInstalledMock.mockClear();
    checkGitHubIntegrationMock.mockClear();
    createCustomEnvironmentMock.mockClear();
    createProjectMock.mockClear();
    linkGitHubMock.mockClear();
    updateProjectSettingsMock.mockClear();
  });

  afterEach(() => {
    connectionVcr.clear();
  });

  test('resumes only the missing Infisical Vercel connection step', async () => {
    const syncConfigMock = mock(async () => {});
    const { setupVercel } = await import(`../vercelSetup?real=${Date.now()}`);

    await setupVercel('team_123', 'Template Team', syncConfigMock);

    expect(createVercelConnectionMock).toHaveBeenCalledTimes(1);
    expect(createVercelConnectionMock).toHaveBeenCalledWith(
      'infisical-proj-id-000',
      'vercel-token-from-file',
      'template-vercel-connection',
    );

    expect(updateConfigFieldMock).toHaveBeenCalledWith('vercel', 'connectionId', 'vercel-connection-123');
    expect(markCompleteMock).toHaveBeenCalledWith('vercel', 'createInfisicalConnection');
    expect(syncConfigMock).toHaveBeenCalledTimes(1);

    expect(setSecretAsyncMock).not.toHaveBeenCalled();
    expect(createProjectMock).not.toHaveBeenCalled();
    expect(updateProjectSettingsMock).not.toHaveBeenCalled();
    expect(linkGitHubMock).not.toHaveBeenCalled();
    expect(ensureVercelSyncMock).not.toHaveBeenCalled();
  });
});
