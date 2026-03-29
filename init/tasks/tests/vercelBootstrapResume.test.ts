import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { infisicalVercelApi } from '../../api/infisicalVercel';
import { defaultConfig } from '../../tests/mocks';
import type { ProjectConfig } from '../../utils/getProjectConfig';

const readFileMock = mock(async () =>
  JSON.stringify({ token: process.env.VERCEL_API_TOKEN ?? 'vercel-token-from-file' }),
);
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
    infisicalVercelApi.vcr.clear();

    currentConfig = {
      ...cloneDefaultConfig(),
      project: {
        ...cloneDefaultConfig().project,
        name: process.env.PROJECT_NAME ?? cloneDefaultConfig().project.name,
        organization: process.env.ORGANIZATION_NAME ?? 'inixiative',
      },
      infisical: {
        ...cloneDefaultConfig().infisical,
        projectId: process.env.INFISICAL_PROJECT_ID ?? 'infisical-proj-id-000',
      },
      vercel: {
        ...cloneDefaultConfig().vercel,
        teamId: process.env.VERCEL_TEAM_ID ?? 'team_123',
        teamName: process.env.VERCEL_TEAM_NAME ?? 'Template Team',
        connectionId: '',
        webProjectId: 'web_proj_123',
        adminProjectId: 'admin_proj_123',
        superadminProjectId: 'superadmin_proj_123',
        configProjectName: process.env.PROJECT_NAME ?? cloneDefaultConfig().project.name,
      },
    };
    completedActions = new Set(
      Object.keys(defaultConfig.vercel.progress).filter((action) => action !== 'createInfisicalConnection'),
    );

    // createInfisicalConnection not complete → createVercelConnection
    infisicalVercelApi.vcr.queue('createVercelConnection', 'default');

    readFileMock.mockClear();
    getProjectConfigMock.mockClear();
    updateConfigFieldMock.mockClear();
    isCompleteMock.mockClear();
    markCompleteMock.mockClear();
    setErrorMock.mockClear();
    setSecretAsyncMock.mockClear();
    isAppInstalledMock.mockClear();
    checkGitHubIntegrationMock.mockClear();
    createCustomEnvironmentMock.mockClear();
    createProjectMock.mockClear();
    linkGitHubMock.mockClear();
    updateProjectSettingsMock.mockClear();
  });

  test('resumes only the missing Infisical Vercel connection step', async () => {
    const syncConfigMock = mock(async () => {});
    const { setupVercel } = await import(`../vercelSetup?real=${Date.now()}`);

    await setupVercel('team_123', 'Template Team', syncConfigMock);

    // createVercelConnection was called — verified implicitly (cassette consumed) and by config update
    expect(updateConfigFieldMock).toHaveBeenCalledWith('vercel', 'connectionId', expect.any(String));
    expect(markCompleteMock).toHaveBeenCalledWith('vercel', 'createInfisicalConnection');
    expect(syncConfigMock).toHaveBeenCalledTimes(1);

    // ensureVercelSync not called — if it were, VCR would throw (no cassette queued)
    expect(setSecretAsyncMock).not.toHaveBeenCalled();
    expect(createProjectMock).not.toHaveBeenCalled();
    expect(updateProjectSettingsMock).not.toHaveBeenCalled();
    expect(linkGitHubMock).not.toHaveBeenCalled();
  });
});
