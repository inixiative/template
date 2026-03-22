import { join } from 'node:path';

export type ProjectConfig = {
  launched: boolean;
  project: {
    name: string;
    organization: string;
    progress: {
      renameOrg: boolean;
      renameProject: boolean;
      setup: boolean;
    };
  };
  infisical: {
    projectId: string;
    organizationId: string;
    organizationSlug: string;
    projectSlug: string;
    configProjectName: string;
    progress: {
      selectOrg: boolean;
      createProject: boolean;
      renameEnv: boolean;
      createRootApiFolder: boolean;
      createRootWebFolder: boolean;
      createRootAdminFolder: boolean;
      createRootSuperadminFolder: boolean;
      createStagingApiFolder: boolean;
      createStagingWebFolder: boolean;
      createStagingAdminFolder: boolean;
      createStagingSuperadminFolder: boolean;
      createProdApiFolder: boolean;
      createProdWebFolder: boolean;
      createProdAdminFolder: boolean;
      createProdSuperadminFolder: boolean;
      createStagingApiRootImport: boolean;
      createStagingApiRootAppImport: boolean;
      createStagingApiEnvImport: boolean;
      createStagingWebRootImport: boolean;
      createStagingWebRootAppImport: boolean;
      createStagingWebEnvImport: boolean;
      createStagingAdminRootImport: boolean;
      createStagingAdminRootAppImport: boolean;
      createStagingAdminEnvImport: boolean;
      createStagingSuperadminRootImport: boolean;
      createStagingSuperadminRootAppImport: boolean;
      createStagingSuperadminEnvImport: boolean;
      createProdApiRootImport: boolean;
      createProdApiRootAppImport: boolean;
      createProdApiEnvImport: boolean;
      createProdWebRootImport: boolean;
      createProdWebRootAppImport: boolean;
      createProdWebEnvImport: boolean;
      createProdAdminRootImport: boolean;
      createProdAdminRootAppImport: boolean;
      createProdAdminEnvImport: boolean;
      createProdSuperadminRootImport: boolean;
      createProdSuperadminRootAppImport: boolean;
      createProdSuperadminEnvImport: boolean;
      ensureProdApiAuthSecret: boolean;
      ensureStagingApiAuthSecret: boolean;
    };
    error: string;
  };
  planetscale: {
    organization: string;
    region: string;
    database: string;
    tokenId: string;
    configProjectName: string;
    progress: {
      selectOrg: boolean;
      selectRegion: boolean;
      recordTokenId: boolean;
      storeOrganizationSecret: boolean;
      storeRegionSecret: boolean;
      storeTokenIdSecret: boolean;
      storeTokenSecret: boolean;
      createDB: boolean;
      renameProductionBranch: boolean;
      createStagingBranch: boolean;
      createProdRole: boolean;
      createStagingRole: boolean;
      storeProdConnectionString: boolean;
      storeStagingConnectionString: boolean;
      initProdMigrationTable: boolean;
      initStagingMigrationTable: boolean;
      configureDB: boolean;
    };
    error: string;
  };
  railway: {
    projectId: string;
    workspaceId: string;
    prodEnvironmentId: string;
    stagingEnvironmentId: string;
    prodApiServiceId: string;
    stagingApiServiceId: string;
    prodWorkerServiceId: string;
    stagingWorkerServiceId: string;
    prodRedisServiceId: string;
    stagingRedisServiceId: string;
    prodRedisVolumeId: string;
    stagingRedisVolumeId: string;
    configProjectName: string;
    progress: {
      selectWorkspace: boolean;
      storeRailwayToken: boolean;
      createProject: boolean;
      ensureProdEnvironment: boolean;
      storeProdEnvironmentIdSecret: boolean;
      deleteLegacyProductionEnvironment: boolean;
      ensureStagingEnvironment: boolean;
      storeStagingEnvironmentIdSecret: boolean;
      ensureProdRedisService: boolean;
      captureProdRedisVolume: boolean;
      renameProdRedisService: boolean;
      renameProdRedisVolume: boolean;
      storeProdRedisUrl: boolean;
      ensureStagingRedisService: boolean;
      captureStagingRedisVolume: boolean;
      renameStagingRedisService: boolean;
      renameStagingRedisVolume: boolean;
      storeStagingRedisUrl: boolean;
      createInfisicalConnection: boolean;
      promptedForGithub: boolean;
      ensureProdApiService: boolean;
      storeProdApiServiceIdSecret: boolean;
      createInfisicalSyncProd: boolean;
      configureProdApiService: boolean;
      connectProdApiGithub: boolean;
      ensureProdApiDeployment: boolean;
      ensureStagingApiService: boolean;
      storeStagingApiServiceIdSecret: boolean;
      createInfisicalSyncStagingApi: boolean;
      configureStagingApiService: boolean;
      connectStagingApiGithub: boolean;
      ensureStagingApiDeployment: boolean;
      storeProdApiUrl: boolean;
      storeStagingApiUrl: boolean;
      ensureProdWorkerService: boolean;
      storeProdWorkerServiceIdSecret: boolean;
      createInfisicalSyncProdWorker: boolean;
      configureProdWorkerService: boolean;
      connectProdWorkerGithub: boolean;
      ensureProdWorkerDeployment: boolean;
      ensureStagingWorkerService: boolean;
      storeStagingWorkerServiceIdSecret: boolean;
      createInfisicalSyncStagingWorker: boolean;
      configureStagingWorkerService: boolean;
      connectStagingWorkerGithub: boolean;
      ensureStagingWorkerDeployment: boolean;
    };
    error: string;
  };
  vercel: {
    teamId: string;
    teamName: string;
    connectionId: string;
    webProjectId: string;
    adminProjectId: string;
    superadminProjectId: string;
    configProjectName: string;
    progress: {
      selectTeam: boolean;
      promptedForGithub: boolean;
      storeTeamIdSecret: boolean;
      storeTeamNameSecret: boolean;
      storeVercelToken: boolean;
      createInfisicalConnection: boolean;
      // Web app
      createWebProject: boolean;
      configureWebRootDirectory: boolean;
      createWebStagingEnvironment: boolean;
      linkWebGitHub: boolean;
      configureWebBranches: boolean;
      createWebInfisicalSyncProd: boolean;
      createWebInfisicalSyncStaging: boolean;
      createWebInfisicalSyncPreview: boolean;
      // Admin app
      createAdminProject: boolean;
      configureAdminRootDirectory: boolean;
      createAdminStagingEnvironment: boolean;
      linkAdminGitHub: boolean;
      configureAdminBranches: boolean;
      createAdminInfisicalSyncProd: boolean;
      createAdminInfisicalSyncStaging: boolean;
      createAdminInfisicalSyncPreview: boolean;
      // Superadmin app
      createSuperadminProject: boolean;
      configureSuperadminRootDirectory: boolean;
      createSuperadminStagingEnvironment: boolean;
      linkSuperadminGitHub: boolean;
      configureSuperadminBranches: boolean;
      createSuperadminInfisicalSyncProd: boolean;
      createSuperadminInfisicalSyncStaging: boolean;
      createSuperadminInfisicalSyncPreview: boolean;
      // Final
      deployProduction: boolean;
    };
    error: string;
  };
};

const defaultInfisicalProgress: ProjectConfig['infisical']['progress'] = {
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
  ensureProdApiAuthSecret: false,
  ensureStagingApiAuthSecret: false,
};

const normalizeInfisicalProgress = (
  progress: Partial<Record<string, boolean>> | undefined,
): ProjectConfig['infisical']['progress'] => {
  const raw = progress ?? {};

  return {
    selectOrg: raw.selectOrg === true,
    createProject: raw.createProject === true,
    renameEnv: raw.renameEnv === true,
    // Legacy bundled flag fans out so older in-progress configs still resume cleanly.
    createRootApiFolder: raw.createRootApiFolder === true || raw.createApps === true,
    createRootWebFolder: raw.createRootWebFolder === true || raw.createApps === true,
    createRootAdminFolder: raw.createRootAdminFolder === true || raw.createApps === true,
    createRootSuperadminFolder: raw.createRootSuperadminFolder === true || raw.createApps === true,
    createStagingApiFolder: raw.createStagingApiFolder === true || raw.createApps === true,
    createStagingWebFolder: raw.createStagingWebFolder === true || raw.createApps === true,
    createStagingAdminFolder: raw.createStagingAdminFolder === true || raw.createApps === true,
    createStagingSuperadminFolder: raw.createStagingSuperadminFolder === true || raw.createApps === true,
    createProdApiFolder: raw.createProdApiFolder === true || raw.createApps === true,
    createProdWebFolder: raw.createProdWebFolder === true || raw.createApps === true,
    createProdAdminFolder: raw.createProdAdminFolder === true || raw.createApps === true,
    createProdSuperadminFolder: raw.createProdSuperadminFolder === true || raw.createApps === true,
    createStagingApiRootImport: raw.createStagingApiRootImport === true || raw.setInheritance === true,
    createStagingApiRootAppImport: raw.createStagingApiRootAppImport === true || raw.setInheritance === true,
    createStagingApiEnvImport: raw.createStagingApiEnvImport === true || raw.setInheritance === true,
    createStagingWebRootImport: raw.createStagingWebRootImport === true || raw.setInheritance === true,
    createStagingWebRootAppImport: raw.createStagingWebRootAppImport === true || raw.setInheritance === true,
    createStagingWebEnvImport: raw.createStagingWebEnvImport === true || raw.setInheritance === true,
    createStagingAdminRootImport: raw.createStagingAdminRootImport === true || raw.setInheritance === true,
    createStagingAdminRootAppImport: raw.createStagingAdminRootAppImport === true || raw.setInheritance === true,
    createStagingAdminEnvImport: raw.createStagingAdminEnvImport === true || raw.setInheritance === true,
    createStagingSuperadminRootImport: raw.createStagingSuperadminRootImport === true || raw.setInheritance === true,
    createStagingSuperadminRootAppImport:
      raw.createStagingSuperadminRootAppImport === true || raw.setInheritance === true,
    createStagingSuperadminEnvImport: raw.createStagingSuperadminEnvImport === true || raw.setInheritance === true,
    createProdApiRootImport: raw.createProdApiRootImport === true || raw.setInheritance === true,
    createProdApiRootAppImport: raw.createProdApiRootAppImport === true || raw.setInheritance === true,
    createProdApiEnvImport: raw.createProdApiEnvImport === true || raw.setInheritance === true,
    createProdWebRootImport: raw.createProdWebRootImport === true || raw.setInheritance === true,
    createProdWebRootAppImport: raw.createProdWebRootAppImport === true || raw.setInheritance === true,
    createProdWebEnvImport: raw.createProdWebEnvImport === true || raw.setInheritance === true,
    createProdAdminRootImport: raw.createProdAdminRootImport === true || raw.setInheritance === true,
    createProdAdminRootAppImport: raw.createProdAdminRootAppImport === true || raw.setInheritance === true,
    createProdAdminEnvImport: raw.createProdAdminEnvImport === true || raw.setInheritance === true,
    createProdSuperadminRootImport: raw.createProdSuperadminRootImport === true || raw.setInheritance === true,
    createProdSuperadminRootAppImport: raw.createProdSuperadminRootAppImport === true || raw.setInheritance === true,
    createProdSuperadminEnvImport: raw.createProdSuperadminEnvImport === true || raw.setInheritance === true,
    ensureProdApiAuthSecret: raw.ensureProdApiAuthSecret === true || raw.ensureApiAuthSecrets === true,
    ensureStagingApiAuthSecret: raw.ensureStagingApiAuthSecret === true || raw.ensureApiAuthSecrets === true,
  };
};

const defaultPlanetScaleProgress: ProjectConfig['planetscale']['progress'] = {
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
};

const defaultRailwayProgress: ProjectConfig['railway']['progress'] = {
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
};

const defaultVercelProgress: ProjectConfig['vercel']['progress'] = {
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
  createAdminProject: false,
  configureAdminRootDirectory: false,
  createAdminStagingEnvironment: false,
  linkAdminGitHub: false,
  configureAdminBranches: false,
  createAdminInfisicalSyncProd: false,
  createAdminInfisicalSyncStaging: false,
  createAdminInfisicalSyncPreview: false,
  createSuperadminProject: false,
  configureSuperadminRootDirectory: false,
  createSuperadminStagingEnvironment: false,
  linkSuperadminGitHub: false,
  configureSuperadminBranches: false,
  createSuperadminInfisicalSyncProd: false,
  createSuperadminInfisicalSyncStaging: false,
  createSuperadminInfisicalSyncPreview: false,
  deployProduction: false,
};

const normalizeVercelProgress = (
  progress: Partial<Record<string, boolean>> | undefined,
): ProjectConfig['vercel']['progress'] => {
  const raw = progress ?? {};
  const hasLegacySync =
    raw.createWebInfisicalSyncProd === true ||
    raw.createWebInfisicalSyncStaging === true ||
    raw.createWebInfisicalSyncPreview === true ||
    raw.createAdminInfisicalSyncProd === true ||
    raw.createAdminInfisicalSyncStaging === true ||
    raw.createAdminInfisicalSyncPreview === true ||
    raw.createSuperadminInfisicalSyncProd === true ||
    raw.createSuperadminInfisicalSyncStaging === true ||
    raw.createSuperadminInfisicalSyncPreview === true ||
    raw.deployProduction === true;

  return {
    selectTeam: raw.selectTeam === true,
    promptedForGithub: raw.promptedForGithub === true,
    storeTeamIdSecret: raw.storeTeamIdSecret === true || raw.selectTeam === true,
    storeTeamNameSecret: raw.storeTeamNameSecret === true || raw.selectTeam === true,
    storeVercelToken: raw.storeVercelToken === true || hasLegacySync,
    createInfisicalConnection: raw.createInfisicalConnection === true || hasLegacySync,
    createWebProject: raw.createWebProject === true,
    configureWebRootDirectory: raw.configureWebRootDirectory === true,
    createWebStagingEnvironment: raw.createWebStagingEnvironment === true,
    linkWebGitHub: raw.linkWebGitHub === true,
    configureWebBranches: raw.configureWebBranches === true,
    createWebInfisicalSyncProd: raw.createWebInfisicalSyncProd === true,
    createWebInfisicalSyncStaging: raw.createWebInfisicalSyncStaging === true,
    createWebInfisicalSyncPreview: raw.createWebInfisicalSyncPreview === true,
    createAdminProject: raw.createAdminProject === true,
    configureAdminRootDirectory: raw.configureAdminRootDirectory === true,
    createAdminStagingEnvironment: raw.createAdminStagingEnvironment === true,
    linkAdminGitHub: raw.linkAdminGitHub === true,
    configureAdminBranches: raw.configureAdminBranches === true,
    createAdminInfisicalSyncProd: raw.createAdminInfisicalSyncProd === true,
    createAdminInfisicalSyncStaging: raw.createAdminInfisicalSyncStaging === true,
    createAdminInfisicalSyncPreview: raw.createAdminInfisicalSyncPreview === true,
    createSuperadminProject: raw.createSuperadminProject === true,
    configureSuperadminRootDirectory: raw.configureSuperadminRootDirectory === true,
    createSuperadminStagingEnvironment: raw.createSuperadminStagingEnvironment === true,
    linkSuperadminGitHub: raw.linkSuperadminGitHub === true,
    configureSuperadminBranches: raw.configureSuperadminBranches === true,
    createSuperadminInfisicalSyncProd: raw.createSuperadminInfisicalSyncProd === true,
    createSuperadminInfisicalSyncStaging: raw.createSuperadminInfisicalSyncStaging === true,
    createSuperadminInfisicalSyncPreview: raw.createSuperadminInfisicalSyncPreview === true,
    deployProduction: raw.deployProduction === true,
  };
};

const normalizeRailwayProgress = (
  progress: Partial<Record<string, boolean>> | undefined,
): ProjectConfig['railway']['progress'] => {
  const raw = progress ?? {};

  return {
    selectWorkspace: raw.selectWorkspace === true,
    storeRailwayToken: raw.storeRailwayToken === true,
    createProject: raw.createProject === true,
    ensureProdEnvironment: raw.ensureProdEnvironment === true || raw.renameProductionEnv === true,
    storeProdEnvironmentIdSecret: raw.storeProdEnvironmentIdSecret === true || raw.renameProductionEnv === true,
    deleteLegacyProductionEnvironment:
      raw.deleteLegacyProductionEnvironment === true || raw.renameProductionEnv === true,
    ensureStagingEnvironment: raw.ensureStagingEnvironment === true || raw.createStagingEnv === true,
    storeStagingEnvironmentIdSecret: raw.storeStagingEnvironmentIdSecret === true || raw.createStagingEnv === true,
    ensureProdRedisService: raw.ensureProdRedisService === true || raw.createRedisProd === true,
    captureProdRedisVolume: raw.captureProdRedisVolume === true || raw.createRedisProd === true,
    renameProdRedisService: raw.renameProdRedisService === true || raw.renameRedisProd === true,
    renameProdRedisVolume: raw.renameProdRedisVolume === true || raw.renameRedisProdVolume === true,
    storeProdRedisUrl: raw.storeProdRedisUrl === true || raw.storeRedisUrl === true,
    ensureStagingRedisService: raw.ensureStagingRedisService === true || raw.createRedisStaging === true,
    captureStagingRedisVolume: raw.captureStagingRedisVolume === true || raw.createRedisStaging === true,
    renameStagingRedisService: raw.renameStagingRedisService === true || raw.renameRedisStaging === true,
    renameStagingRedisVolume: raw.renameStagingRedisVolume === true || raw.renameRedisStagingVolume === true,
    storeStagingRedisUrl: raw.storeStagingRedisUrl === true || raw.storeRedisUrl === true,
    createInfisicalConnection: raw.createInfisicalConnection === true,
    promptedForGithub: raw.promptedForGithub === true,
    ensureProdApiService: raw.ensureProdApiService === true || raw.createApiProd === true,
    storeProdApiServiceIdSecret: raw.storeProdApiServiceIdSecret === true || raw.createApiProd === true,
    createInfisicalSyncProd: raw.createInfisicalSyncProd === true,
    configureProdApiService: raw.configureProdApiService === true || raw.connectApiProdGithub === true,
    connectProdApiGithub: raw.connectProdApiGithub === true || raw.connectApiProdGithub === true,
    ensureProdApiDeployment:
      raw.ensureProdApiDeployment === true || raw.connectApiProdGithub === true || raw.verifyDeployment === true,
    ensureStagingApiService: raw.ensureStagingApiService === true || raw.createApiStaging === true,
    storeStagingApiServiceIdSecret: raw.storeStagingApiServiceIdSecret === true || raw.createApiStaging === true,
    createInfisicalSyncStagingApi: raw.createInfisicalSyncStagingApi === true,
    configureStagingApiService: raw.configureStagingApiService === true || raw.connectApiStagingGithub === true,
    connectStagingApiGithub: raw.connectStagingApiGithub === true || raw.connectApiStagingGithub === true,
    ensureStagingApiDeployment:
      raw.ensureStagingApiDeployment === true || raw.connectApiStagingGithub === true || raw.verifyDeployment === true,
    storeProdApiUrl: raw.storeProdApiUrl === true || raw.storeApiUrl === true,
    storeStagingApiUrl: raw.storeStagingApiUrl === true || raw.storeApiUrl === true,
    ensureProdWorkerService: raw.ensureProdWorkerService === true || raw.createWorkerProd === true,
    storeProdWorkerServiceIdSecret: raw.storeProdWorkerServiceIdSecret === true || raw.createWorkerProd === true,
    createInfisicalSyncProdWorker:
      raw.createInfisicalSyncProdWorker === true ||
      raw.connectWorkerProdGithub === true ||
      raw.verifyDeployment === true,
    configureProdWorkerService: raw.configureProdWorkerService === true || raw.connectWorkerProdGithub === true,
    connectProdWorkerGithub: raw.connectProdWorkerGithub === true || raw.connectWorkerProdGithub === true,
    ensureProdWorkerDeployment:
      raw.ensureProdWorkerDeployment === true || raw.connectWorkerProdGithub === true || raw.verifyDeployment === true,
    ensureStagingWorkerService: raw.ensureStagingWorkerService === true || raw.createWorkerStaging === true,
    storeStagingWorkerServiceIdSecret:
      raw.storeStagingWorkerServiceIdSecret === true || raw.createWorkerStaging === true,
    createInfisicalSyncStagingWorker:
      raw.createInfisicalSyncStagingWorker === true ||
      raw.connectWorkerStagingGithub === true ||
      raw.verifyDeployment === true,
    configureStagingWorkerService:
      raw.configureStagingWorkerService === true || raw.connectWorkerStagingGithub === true,
    connectStagingWorkerGithub: raw.connectStagingWorkerGithub === true || raw.connectWorkerStagingGithub === true,
    ensureStagingWorkerDeployment:
      raw.ensureStagingWorkerDeployment === true ||
      raw.connectWorkerStagingGithub === true ||
      raw.verifyDeployment === true,
  };
};

const normalizePlanetScaleProgress = (
  progress: Partial<Record<string, boolean>> | undefined,
): ProjectConfig['planetscale']['progress'] => {
  const raw = progress ?? {};

  return {
    selectOrg: raw.selectOrg === true,
    selectRegion: raw.selectRegion === true,
    recordTokenId: raw.recordTokenId === true || raw.createToken === true,
    storeOrganizationSecret: raw.storeOrganizationSecret === true || raw.setInfisicalToken === true,
    storeRegionSecret: raw.storeRegionSecret === true || raw.setInfisicalToken === true,
    storeTokenIdSecret: raw.storeTokenIdSecret === true || raw.setInfisicalToken === true,
    storeTokenSecret: raw.storeTokenSecret === true || raw.setInfisicalToken === true,
    createDB: raw.createDB === true,
    renameProductionBranch: raw.renameProductionBranch === true,
    createStagingBranch: raw.createStagingBranch === true,
    // Legacy bundled flags fan out to the new atomic flags so existing in-progress configs still resume correctly.
    createProdRole: raw.createProdRole === true || raw.createPasswords === true,
    createStagingRole: raw.createStagingRole === true || raw.createPasswords === true,
    storeProdConnectionString: raw.storeProdConnectionString === true || raw.storeConnectionStrings === true,
    storeStagingConnectionString: raw.storeStagingConnectionString === true || raw.storeConnectionStrings === true,
    initProdMigrationTable: raw.initProdMigrationTable === true || raw.initMigrationTable === true,
    initStagingMigrationTable: raw.initStagingMigrationTable === true || raw.initMigrationTable === true,
    configureDB: raw.configureDB === true,
  };
};

/**
 * Get the project configuration based on USE_INTERNAL_CONFIG env var
 *
 * - USE_INTERNAL_CONFIG=true -> project.config.template-internal.ts
 * - Otherwise -> project.config.ts
 */
export const getProjectConfig = async (): Promise<ProjectConfig> => {
  const useInternal = process.env.USE_INTERNAL_CONFIG === 'true';
  const configFile = useInternal ? 'project.config.template-internal.ts' : 'project.config.ts';
  const configPath = join(process.cwd(), configFile);

  try {
    // Bust import cache with timestamp to get fresh config
    const module = await import(`${configPath}?t=${Date.now()}`);
    const config = module.projectConfig as ProjectConfig;

    return {
      ...config,
      infisical: {
        ...config.infisical,
        progress: normalizeInfisicalProgress(config.infisical?.progress),
      },
      planetscale: {
        ...config.planetscale,
        progress: normalizePlanetScaleProgress(config.planetscale?.progress),
      },
      railway: {
        ...config.railway,
        progress: normalizeRailwayProgress(config.railway?.progress),
      },
      vercel: {
        ...config.vercel,
        connectionId: config.vercel?.connectionId ?? '',
        progress: normalizeVercelProgress(config.vercel?.progress),
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to load project config from ${configFile}. ` +
        `Make sure the file exists and exports 'projectConfig'. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Get the target config file path (for writing updates)
 */
export const getProjectConfigPath = (): string => {
  const useInternal = process.env.USE_INTERNAL_CONFIG === 'true';
  const configFile = useInternal ? 'project.config.template-internal.ts' : 'project.config.ts';
  return join(process.cwd(), configFile);
};

/**
 * Write the project configuration back to file
 */
export const writeProjectConfig = async (config: ProjectConfig): Promise<void> => {
  const { writeFileSync } = await import('node:fs');
  const configPath = getProjectConfigPath();

  const normalizedConfig: ProjectConfig = {
    ...config,
    infisical: {
      ...config.infisical,
      progress: {
        ...defaultInfisicalProgress,
        ...config.infisical.progress,
      },
    },
    planetscale: {
      ...config.planetscale,
      progress: {
        ...defaultPlanetScaleProgress,
        ...config.planetscale.progress,
      },
    },
    railway: {
      ...config.railway,
      progress: {
        ...defaultRailwayProgress,
        ...config.railway.progress,
      },
    },
    vercel: {
      ...config.vercel,
      connectionId: config.vercel.connectionId ?? '',
      progress: {
        ...defaultVercelProgress,
        ...config.vercel.progress,
      },
    },
  };

  // Stringify with tabs for indentation
  const configJson = JSON.stringify(normalizedConfig, null, '\t');

  // Wrap in TypeScript boilerplate
  const content = `export const projectConfig = ${configJson} as const;\n\nexport type ProjectConfig = typeof projectConfig;\n`;

  writeFileSync(configPath, content, 'utf-8');
};
