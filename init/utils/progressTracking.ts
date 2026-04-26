import { getProjectConfig, writeProjectConfig } from './getProjectConfig';

export type ProgressSection =
  | 'project'
  | 'infisical'
  | 'planetscale'
  | 'railway'
  | 'railwayPostgres'
  | 'cloudflarePages'
  | 'resend'
  | 'bouncer'
  | 'vercel';

export type CloudflarePagesAction =
  | 'selectAccount'
  | 'storeApiToken'
  | 'createWebProject'
  | 'linkWebGitHub'
  | 'syncWebEnvProd'
  | 'syncWebEnvStaging'
  | 'createAdminProject'
  | 'linkAdminGitHub'
  | 'syncAdminEnvProd'
  | 'syncAdminEnvStaging'
  | 'createSuperadminProject'
  | 'linkSuperadminGitHub'
  | 'syncSuperadminEnvProd'
  | 'syncSuperadminEnvStaging';

export type RailwayPostgresAction =
  | 'ensureProdPostgresService'
  | 'captureProdPostgresVolume'
  | 'renameProdPostgresService'
  | 'renameProdPostgresVolume'
  | 'storeProdPostgresUrl'
  | 'ensureStagingPostgresService'
  | 'captureStagingPostgresVolume'
  | 'renameStagingPostgresService'
  | 'renameStagingPostgresVolume'
  | 'storeStagingPostgresUrl';

export type InfisicalAction =
  | 'selectOrg'
  | 'createProject'
  | 'renameEnv'
  | 'createRootApiFolder'
  | 'createRootWebFolder'
  | 'createRootAdminFolder'
  | 'createRootSuperadminFolder'
  | 'createStagingApiFolder'
  | 'createStagingWebFolder'
  | 'createStagingAdminFolder'
  | 'createStagingSuperadminFolder'
  | 'createProdApiFolder'
  | 'createProdWebFolder'
  | 'createProdAdminFolder'
  | 'createProdSuperadminFolder'
  | 'createStagingApiRootImport'
  | 'createStagingApiRootAppImport'
  | 'createStagingApiEnvImport'
  | 'createStagingWebRootImport'
  | 'createStagingWebRootAppImport'
  | 'createStagingWebEnvImport'
  | 'createStagingAdminRootImport'
  | 'createStagingAdminRootAppImport'
  | 'createStagingAdminEnvImport'
  | 'createStagingSuperadminRootImport'
  | 'createStagingSuperadminRootAppImport'
  | 'createStagingSuperadminEnvImport'
  | 'createProdApiRootImport'
  | 'createProdApiRootAppImport'
  | 'createProdApiEnvImport'
  | 'createProdWebRootImport'
  | 'createProdWebRootAppImport'
  | 'createProdWebEnvImport'
  | 'createProdAdminRootImport'
  | 'createProdAdminRootAppImport'
  | 'createProdAdminEnvImport'
  | 'createProdSuperadminRootImport'
  | 'createProdSuperadminRootAppImport'
  | 'createProdSuperadminEnvImport'
  | 'storeProjectNameSecret'
  | 'storeViteProjectNameSecret'
  | 'storeViteAppShortNameSecret'
  | 'storeWebAppNameSecret'
  | 'storeAdminAppNameSecret'
  | 'storeSuperadminAppNameSecret'
  | 'ensureProdApiAuthSecret'
  | 'ensureStagingApiAuthSecret';
export type ProjectAction =
  | 'renameOrg'
  | 'updatePackages'
  | 'updateImports'
  | 'updateReadme'
  | 'updateTsconfigs'
  | 'updateEnvFiles'
  | 'cleanInstall'
  | 'setup';
export type PlanetScaleAction =
  | 'selectOrg'
  | 'selectRegion'
  | 'recordTokenId'
  | 'storeOrganizationSecret'
  | 'storeRegionSecret'
  | 'storeTokenIdSecret'
  | 'storeTokenSecret'
  | 'createDB'
  | 'renameProductionBranch'
  | 'createStagingBranch'
  | 'createProdRole'
  | 'createStagingRole'
  | 'storeProdConnectionString'
  | 'storeStagingConnectionString'
  | 'initProdMigrationTable'
  | 'initStagingMigrationTable'
  | 'configureDB';

export type RailwayAction =
  | 'selectWorkspace'
  | 'storeRailwayToken'
  | 'createProject'
  | 'ensureProdEnvironment'
  | 'storeProdEnvironmentIdSecret'
  | 'deleteLegacyProductionEnvironment'
  | 'ensureStagingEnvironment'
  | 'storeStagingEnvironmentIdSecret'
  | 'ensureProdRedisService'
  | 'captureProdRedisVolume'
  | 'renameProdRedisService'
  | 'renameProdRedisVolume'
  | 'storeProdRedisUrl'
  | 'ensureStagingRedisService'
  | 'captureStagingRedisVolume'
  | 'renameStagingRedisService'
  | 'renameStagingRedisVolume'
  | 'storeStagingRedisUrl'
  | 'createInfisicalConnection'
  | 'promptedForGithub'
  | 'ensureProdApiService'
  | 'storeProdApiServiceIdSecret'
  | 'createInfisicalSyncProd'
  | 'configureProdApiService'
  | 'connectProdApiGithub'
  | 'ensureProdApiDeployment'
  | 'ensureStagingApiService'
  | 'storeStagingApiServiceIdSecret'
  | 'createInfisicalSyncStagingApi'
  | 'configureStagingApiService'
  | 'connectStagingApiGithub'
  | 'ensureStagingApiDeployment'
  | 'storeProdApiUrl'
  | 'storeStagingApiUrl'
  | 'ensureProdWorkerService'
  | 'storeProdWorkerServiceIdSecret'
  | 'createInfisicalSyncProdWorker'
  | 'configureProdWorkerService'
  | 'connectProdWorkerGithub'
  | 'ensureProdWorkerDeployment'
  | 'ensureStagingWorkerService'
  | 'storeStagingWorkerServiceIdSecret'
  | 'createInfisicalSyncStagingWorker'
  | 'configureStagingWorkerService'
  | 'connectStagingWorkerGithub'
  | 'ensureStagingWorkerDeployment';

export type VercelAction =
  | 'selectTeam'
  | 'promptedForGithub'
  | 'storeTeamIdSecret'
  | 'storeTeamNameSecret'
  | 'storeVercelToken'
  | 'createInfisicalConnection'
  | 'createWebProject'
  | 'configureWebRootDirectory'
  | 'createWebStagingEnvironment'
  | 'linkWebGitHub'
  | 'configureWebBranches'
  | 'createWebInfisicalSyncProd'
  | 'createWebInfisicalSyncStaging'
  | 'createWebInfisicalSyncPreview'
  | 'storeProdWebUrls'
  | 'storeStagingWebUrls'
  | 'createAdminProject'
  | 'configureAdminRootDirectory'
  | 'createAdminStagingEnvironment'
  | 'linkAdminGitHub'
  | 'configureAdminBranches'
  | 'createAdminInfisicalSyncProd'
  | 'createAdminInfisicalSyncStaging'
  | 'createAdminInfisicalSyncPreview'
  | 'storeProdAdminUrls'
  | 'storeStagingAdminUrls'
  | 'createSuperadminProject'
  | 'configureSuperadminRootDirectory'
  | 'createSuperadminStagingEnvironment'
  | 'linkSuperadminGitHub'
  | 'configureSuperadminBranches'
  | 'createSuperadminInfisicalSyncProd'
  | 'createSuperadminInfisicalSyncStaging'
  | 'createSuperadminInfisicalSyncPreview'
  | 'storeProdSuperadminUrls'
  | 'storeStagingSuperadminUrls'
  | 'deployProduction';

export type ResendAction = 'storeApiKey' | 'storeFromAddress' | 'addDomain' | 'confirmDns';

export type BouncerAction = 'storeApiKey';

export type ProgressActions = {
  project: ProjectAction;
  infisical: InfisicalAction;
  planetscale: PlanetScaleAction;
  railway: RailwayAction;
  railwayPostgres: RailwayPostgresAction;
  cloudflarePages: CloudflarePagesAction;
  resend: ResendAction;
  bouncer: BouncerAction;
  vercel: VercelAction;
};

/**
 * Mark a step as complete
 */
export const markComplete = async <S extends ProgressSection>(
  section: S,
  action: ProgressActions[S],
): Promise<void> => {
  const config = await getProjectConfig();
  (config[section] as { progress: Record<string, boolean> }).progress[action] = true;
  await writeProjectConfig(config);
};

/**
 * Check if a step is complete
 */
export const isComplete = async <S extends ProgressSection>(
  section: S,
  action: ProgressActions[S],
): Promise<boolean> => {
  const config = await getProjectConfig();
  return (config[section] as { progress: Record<string, boolean> }).progress[action] === true;
};

/**
 * Clear all progress for a section (set all flags to false)
 */
export const clearProgress = async (section: ProgressSection): Promise<void> => {
  const config = await getProjectConfig();
  const progress = (config[section] as { progress: Record<string, boolean> }).progress;
  for (const key in progress) {
    progress[key] = false;
  }
  await writeProjectConfig(config);
};

/**
 * Set error message for a section
 */
export const setError = async (section: ProgressSection, message: string): Promise<void> => {
  const config = await getProjectConfig();
  (config[section] as { error: string }).error = message;
  await writeProjectConfig(config);
};

/**
 * Clear error for a section
 */
export const clearError = async (section: ProgressSection): Promise<void> => {
  await setError(section, '');
};
