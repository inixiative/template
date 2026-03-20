import { mock } from 'bun:test';
import type { ProjectConfig } from '../../utils/getProjectConfig';

/** Default test config — override fields as needed */
const defaultConfig: ProjectConfig = {
  project: { name: 'template', organization: 'test-org' },
  infisical: {
    projectId: 'infisical-proj-id-000',
    organizationId: 'infisical-org-id-000',
    configProjectName: 'template',
    progress: {
      createProject: true,
      createEnvironments: true,
      createFolders: true,
      createSecretImports: true,
    },
    error: null,
  },
  planetscale: {
    organization: 'test-org',
    database: 'template',
    region: 'us-east',
    tokenId: 'pscale_tkid_SANITIZED_abc123',
    configProjectName: 'template',
    progress: {
      selectOrg: false,
      selectRegion: false,
      createToken: false,
      setInfisicalToken: false,
      createDB: false,
      renameProductionBranch: false,
      createStagingBranch: false,
      createPasswords: false,
      storeConnectionStrings: false,
      initMigrationTable: false,
      configureDB: false,
    },
    error: null,
  },
  railway: {
    workspaceId: '',
    projectId: '',
    prodEnvironmentId: '',
    stagingEnvironmentId: '',
    prodApiServiceId: '',
    stagingApiServiceId: '',
    prodWorkerServiceId: '',
    stagingWorkerServiceId: '',
    prodRedisServiceId: '',
    stagingRedisServiceId: '',
    prodRedisVolumeId: '',
    stagingRedisVolumeId: '',
    configProjectName: '',
    progress: {
      selectWorkspace: false,
      storeRailwayToken: false,
      createProject: false,
      renameProductionEnv: false,
      createStagingEnv: false,
      createRedisProd: false,
      renameRedisProd: false,
      renameRedisProdVolume: false,
      createRedisStaging: false,
      renameRedisStaging: false,
      renameRedisStagingVolume: false,
      storeRedisUrl: false,
      createInfisicalConnection: false,
      promptedForGithub: false,
      createApiProd: false,
      createInfisicalSyncProd: false,
      connectApiProdGithub: false,
      createApiStaging: false,
      createInfisicalSyncStagingApi: false,
      connectApiStagingGithub: false,
      storeApiUrl: false,
      createWorkerProd: false,
      connectWorkerProdGithub: false,
      createWorkerStaging: false,
      createInfisicalSyncStagingWorker: false,
      connectWorkerStagingGithub: false,
      verifyDeployment: false,
    },
    error: null,
  },
  vercel: {
    teamId: '',
    projectId: '',
    configProjectName: '',
    progress: {
      selectTeam: false,
      storeVercelToken: false,
      createProject: false,
      configureProject: false,
      promptedForGithub: false,
      connectGithub: false,
      createInfisicalConnection: false,
      createInfisicalSyncProd: false,
      createInfisicalSyncStaging: false,
      createInfisicalSyncPreview: false,
      verifyDeployment: false,
    },
    error: null,
  },
} as unknown as ProjectConfig;

export const createMockConfig = (overrides?: Partial<ProjectConfig>) => {
  let currentConfig = { ...defaultConfig, ...overrides } as ProjectConfig;

  const mockGetProjectConfig = mock(async () => currentConfig);

  const progressState = new Map<string, Set<string>>();

  const mockIsProgressComplete = mock(async (section: string, action: string) => {
    const completed = progressState.get(section);
    if (completed?.has(action)) return true;
    const sectionConfig = currentConfig[section as keyof ProjectConfig];
    if (sectionConfig && typeof sectionConfig === 'object' && 'progress' in sectionConfig) {
      return (sectionConfig.progress as Record<string, boolean>)[action] ?? false;
    }
    return false;
  });

  const mockSetProgressComplete = mock(async (section: string, action: string) => {
    if (!progressState.has(section)) progressState.set(section, new Set());
    progressState.get(section)!.add(action);
  });

  const mockUpdateConfigField = mock(async () => {});
  const mockClearConfigError = mock(async () => {});
  const mockSetConfigError = mock(async () => {});
  const mockClearAllProgress = mock(async (section: string) => {
    progressState.delete(section);
  });

  const configHelperMocks = {
    isProgressComplete: mockIsProgressComplete,
    setProgressComplete: mockSetProgressComplete,
    updateConfigField: mockUpdateConfigField,
    clearConfigError: mockClearConfigError,
    setConfigError: mockSetConfigError,
    clearAllProgress: mockClearAllProgress,
  };

  return {
    mocks: { getProjectConfig: mockGetProjectConfig, ...configHelperMocks },
    /** Update the config that getProjectConfig returns */
    setConfig: (config: ProjectConfig) => {
      currentConfig = config;
    },
    /** Mark steps as already complete (for resume scenarios) */
    markComplete: (section: string, actions: string[]) => {
      if (!progressState.has(section)) progressState.set(section, new Set());
      for (const action of actions) progressState.get(section)!.add(action);
    },
    install: () => {
      mock.module('../../utils/getProjectConfig', () => ({
        getProjectConfig: mockGetProjectConfig,
      }));
      mock.module('../../utils/configHelpers', () => configHelperMocks);
    },
    clearAll: () => {
      for (const fn of Object.values(configHelperMocks)) fn.mockClear();
      mockGetProjectConfig.mockClear();
      progressState.clear();
    },
  };
};

export { defaultConfig };
export type MockConfig = ReturnType<typeof createMockConfig>;
