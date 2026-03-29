import { mock } from 'bun:test';
import type { ProjectConfig } from '../../utils/getProjectConfig';

const envProjectName = process.env.PROJECT_NAME ?? 'template';
const envOrganizationName = process.env.ORGANIZATION_NAME ?? process.env.PLANETSCALE_ORG ?? 'test-org';

/** Default test config — override fields as needed */
const defaultConfig: ProjectConfig = {
  launched: false,
  project: {
    name: envProjectName,
    organization: envOrganizationName,
    progress: {
      renameOrg: false,
      updatePackages: false,
      updateImports: false,
      updateReadme: false,
      updateTsconfigs: false,
      updateEnvFiles: false,
      cleanInstall: false,
      setup: false,
    },
  },
  resend: {
    provider: 'resend',
    fromAddress: '',
    domainId: '',
    configProjectName: envProjectName,
    progress: {
      storeProdApiKey: false,
      storeStagingApiKey: false,
      storeProdFromAddress: false,
      storeStagingFromAddress: false,
      addDomain: false,
      confirmDns: false,
    },
    error: '',
  },
  infisical: {
    projectId: process.env.INFISICAL_PROJECT_ID ?? 'infisical-proj-id-000',
    organizationId: process.env.INFISICAL_ORG_ID ?? 'infisical-org-id-000',
    organizationSlug: envOrganizationName,
    projectSlug: envProjectName,
    configProjectName: envProjectName,
    progress: {
      selectOrg: false,
      createProject: false,
      renameEnv: false,
      createRootApiFolder: false,
      createRootWebFolder: false,
      createRootAdminFolder: false,
      createRootSuperadminFolder: false,
      createStagingApiFolder: false,
      createStagingWebFolder: false,
      createStagingAdminFolder: false,
      createStagingSuperadminFolder: false,
      createProdApiFolder: false,
      createProdWebFolder: false,
      createProdAdminFolder: false,
      createProdSuperadminFolder: false,
      createStagingApiRootImport: false,
      createStagingApiRootAppImport: false,
      createStagingApiEnvImport: false,
      createStagingWebRootImport: false,
      createStagingWebRootAppImport: false,
      createStagingWebEnvImport: false,
      createStagingAdminRootImport: false,
      createStagingAdminRootAppImport: false,
      createStagingAdminEnvImport: false,
      createStagingSuperadminRootImport: false,
      createStagingSuperadminRootAppImport: false,
      createStagingSuperadminEnvImport: false,
      createProdApiRootImport: false,
      createProdApiRootAppImport: false,
      createProdApiEnvImport: false,
      createProdWebRootImport: false,
      createProdWebRootAppImport: false,
      createProdWebEnvImport: false,
      createProdAdminRootImport: false,
      createProdAdminRootAppImport: false,
      createProdAdminEnvImport: false,
      createProdSuperadminRootImport: false,
      createProdSuperadminRootAppImport: false,
      createProdSuperadminEnvImport: false,
      storeProjectNameSecret: false,
      storeViteProjectNameSecret: false,
      storeViteAppShortNameSecret: false,
      storeWebAppNameSecret: false,
      storeAdminAppNameSecret: false,
      storeSuperadminAppNameSecret: false,
      ensureProdApiAuthSecret: false,
      ensureStagingApiAuthSecret: false,
    },
    error: '',
  },
  planetscale: {
    organization: process.env.PLANETSCALE_ORG ?? envOrganizationName,
    database: envProjectName,
    region: process.env.PLANETSCALE_REGION ?? 'us-east',
    tokenId: process.env.PLANETSCALE_TOKEN_ID ?? 'pscale_tkid_SANITIZED_abc123',
    configProjectName: envProjectName,
    progress: {
      selectOrg: false,
      selectRegion: false,
      recordTokenId: false,
      storeOrganizationSecret: false,
      storeRegionSecret: false,
      storeTokenIdSecret: false,
      storeTokenSecret: false,
      createDB: false,
      renameProductionBranch: false,
      createStagingBranch: false,
      createProdRole: false,
      createStagingRole: false,
      storeProdConnectionString: false,
      storeStagingConnectionString: false,
      initProdMigrationTable: false,
      initStagingMigrationTable: false,
      configureDB: false,
    },
    error: '',
  },
  railway: {
    workspaceId: process.env.RAILWAY_WORKSPACE_ID ?? '',
    projectId: process.env.RAILWAY_PROJECT_ID ?? '',
    prodEnvironmentId: process.env.RAILWAY_PROD_ENVIRONMENT_ID ?? '',
    stagingEnvironmentId: process.env.RAILWAY_STAGING_ENVIRONMENT_ID ?? '',
    prodApiServiceId: process.env.RAILWAY_PROD_API_SERVICE_ID ?? '',
    stagingApiServiceId: process.env.RAILWAY_STAGING_API_SERVICE_ID ?? '',
    prodWorkerServiceId: process.env.RAILWAY_PROD_WORKER_SERVICE_ID ?? '',
    stagingWorkerServiceId: process.env.RAILWAY_STAGING_WORKER_SERVICE_ID ?? '',
    prodRedisServiceId: process.env.RAILWAY_PROD_REDIS_SERVICE_ID ?? '',
    stagingRedisServiceId: process.env.RAILWAY_STAGING_REDIS_SERVICE_ID ?? '',
    prodRedisVolumeId: process.env.RAILWAY_PROD_REDIS_VOLUME_ID ?? '',
    stagingRedisVolumeId: process.env.RAILWAY_STAGING_REDIS_VOLUME_ID ?? '',
    configProjectName: envProjectName,
    progress: {
      selectWorkspace: false,
      storeRailwayToken: false,
      createProject: false,
      ensureProdEnvironment: false,
      storeProdEnvironmentIdSecret: false,
      deleteLegacyProductionEnvironment: false,
      ensureStagingEnvironment: false,
      storeStagingEnvironmentIdSecret: false,
      ensureProdRedisService: false,
      captureProdRedisVolume: false,
      renameProdRedisService: false,
      renameProdRedisVolume: false,
      storeProdRedisUrl: false,
      ensureStagingRedisService: false,
      captureStagingRedisVolume: false,
      renameStagingRedisService: false,
      renameStagingRedisVolume: false,
      storeStagingRedisUrl: false,
      createInfisicalConnection: false,
      promptedForGithub: false,
      ensureProdApiService: false,
      storeProdApiServiceIdSecret: false,
      createInfisicalSyncProd: false,
      configureProdApiService: false,
      connectProdApiGithub: false,
      ensureProdApiDeployment: false,
      ensureStagingApiService: false,
      storeStagingApiServiceIdSecret: false,
      createInfisicalSyncStagingApi: false,
      configureStagingApiService: false,
      connectStagingApiGithub: false,
      ensureStagingApiDeployment: false,
      storeProdApiUrl: false,
      storeStagingApiUrl: false,
      ensureProdWorkerService: false,
      storeProdWorkerServiceIdSecret: false,
      createInfisicalSyncProdWorker: false,
      configureProdWorkerService: false,
      connectProdWorkerGithub: false,
      ensureProdWorkerDeployment: false,
      ensureStagingWorkerService: false,
      storeStagingWorkerServiceIdSecret: false,
      createInfisicalSyncStagingWorker: false,
      configureStagingWorkerService: false,
      connectStagingWorkerGithub: false,
      ensureStagingWorkerDeployment: false,
    },
    error: '',
  },
  vercel: {
    teamId: process.env.VERCEL_TEAM_ID ?? '',
    teamName: process.env.VERCEL_TEAM_NAME ?? '',
    connectionId: '',
    webProjectId: '',
    adminProjectId: '',
    superadminProjectId: '',
    configProjectName: envProjectName,
    progress: {
      selectTeam: false,
      promptedForGithub: false,
      storeTeamIdSecret: false,
      storeTeamNameSecret: false,
      storeVercelToken: false,
      createInfisicalConnection: false,
      createWebProject: false,
      configureWebRootDirectory: false,
      createWebStagingEnvironment: false,
      linkWebGitHub: false,
      configureWebBranches: false,
      createWebInfisicalSyncProd: false,
      createWebInfisicalSyncStaging: false,
      createWebInfisicalSyncPreview: false,
      storeProdWebUrls: false,
      storeStagingWebUrls: false,
      createAdminProject: false,
      configureAdminRootDirectory: false,
      createAdminStagingEnvironment: false,
      linkAdminGitHub: false,
      configureAdminBranches: false,
      createAdminInfisicalSyncProd: false,
      createAdminInfisicalSyncStaging: false,
      createAdminInfisicalSyncPreview: false,
      storeProdAdminUrls: false,
      storeStagingAdminUrls: false,
      createSuperadminProject: false,
      configureSuperadminRootDirectory: false,
      createSuperadminStagingEnvironment: false,
      linkSuperadminGitHub: false,
      configureSuperadminBranches: false,
      createSuperadminInfisicalSyncProd: false,
      createSuperadminInfisicalSyncStaging: false,
      createSuperadminInfisicalSyncPreview: false,
      storeProdSuperadminUrls: false,
      storeStagingSuperadminUrls: false,
      deployProduction: false,
    },
    error: '',
  },
};

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
