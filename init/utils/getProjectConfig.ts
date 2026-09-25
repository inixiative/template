import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Monotonic counter for dynamic-import cache-busting. Date.now() has
// millisecond resolution, which is too coarse for tight markComplete loops
// in init tasks where multiple writes can happen within the same ms — the
// import returns the cached stale module and earlier writes get clobbered.
let cacheBustCounter = 0;

const PROJECT_PROGRESS_KEYS = [
  'renameOrg',
  'updatePackages',
  'updateImports',
  'updateReadme',
  'updateTsconfigs',
  'updateEnvFiles',
  'cleanInstall',
  'setup',
] as const;

const INFISICAL_PROGRESS_KEYS = [
  'selectOrg',
  'createProject',
  'renameEnv',
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
  'createStagingAdminEnvImport',
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
  'storeProjectNameSecret',
  'storeViteProjectNameSecret',
  'storeViteAppShortNameSecret',
  'storeWebAppNameSecret',
  'storeAdminAppNameSecret',
  'storeSuperadminAppNameSecret',
  'ensureProdApiAuthSecret',
  'ensureStagingApiAuthSecret',
  'ensureProdWebhookSigningKeys',
  'ensureStagingWebhookSigningKeys',
  'ensureProdEncryptionKeys',
  'ensureStagingEncryptionKeys',
] as const;

const PLANETSCALE_PROGRESS_KEYS = [
  'selectOrg',
  'selectRegion',
  'recordTokenId',
  'storeOrganizationSecret',
  'storeRegionSecret',
  'storeTokenIdSecret',
  'storeTokenSecret',
  'createDB',
  'renameProductionBranch',
  'createStagingBranch',
  'createProdRole',
  'createStagingRole',
  'storeProdConnectionString',
  'storeStagingConnectionString',
  'initProdMigrationTable',
  'initStagingMigrationTable',
  'configureDB',
] as const;

const RAILWAY_PROGRESS_KEYS = [
  'selectWorkspace',
  'storeRailwayToken',
  'createProject',
  'ensureProdEnvironment',
  'storeProdEnvironmentIdSecret',
  'deleteLegacyProductionEnvironment',
  'ensureStagingEnvironment',
  'storeStagingEnvironmentIdSecret',
  'ensureProdRedisService',
  'captureProdRedisVolume',
  'renameProdRedisService',
  'renameProdRedisVolume',
  'storeProdRedisUrl',
  'ensureStagingRedisService',
  'captureStagingRedisVolume',
  'renameStagingRedisService',
  'renameStagingRedisVolume',
  'storeStagingRedisUrl',
  'createInfisicalConnection',
  'promptedForGithub',
  'ensureProdApiService',
  'storeProdApiServiceIdSecret',
  'createInfisicalSyncProd',
  'configureProdApiService',
  'connectProdApiGithub',
  'ensureProdApiDeployment',
  'ensureStagingApiService',
  'storeStagingApiServiceIdSecret',
  'createInfisicalSyncStagingApi',
  'configureStagingApiService',
  'connectStagingApiGithub',
  'ensureStagingApiDeployment',
  'storeProdApiUrl',
  'storeStagingApiUrl',
  'ensureProdWorkerService',
  'storeProdWorkerServiceIdSecret',
  'createInfisicalSyncProdWorker',
  'configureProdWorkerService',
  'connectProdWorkerGithub',
  'ensureProdWorkerDeployment',
  'ensureStagingWorkerService',
  'storeStagingWorkerServiceIdSecret',
  'createInfisicalSyncStagingWorker',
  'configureStagingWorkerService',
  'connectStagingWorkerGithub',
  'ensureStagingWorkerDeployment',
] as const;

const RESEND_PROGRESS_KEYS = ['storeApiKey', 'storeFromAddress', 'addDomain', 'confirmDns'] as const;

const BOUNCER_PROGRESS_KEYS = ['storeApiKey'] as const;

const VERCEL_PROGRESS_KEYS = [
  'selectTeam',
  'promptedForGithub',
  'storeTeamIdSecret',
  'storeTeamNameSecret',
  'storeVercelToken',
  'createInfisicalConnection',
  'createWebProject',
  'configureWebRootDirectory',
  'createWebStagingEnvironment',
  'linkWebGitHub',
  'configureWebBranches',
  'createWebInfisicalSyncProd',
  'createWebInfisicalSyncStaging',
  'createWebInfisicalSyncPreview',
  'storeProdWebUrls',
  'storeStagingWebUrls',
  'createAdminProject',
  'configureAdminRootDirectory',
  'createAdminStagingEnvironment',
  'linkAdminGitHub',
  'configureAdminBranches',
  'createAdminInfisicalSyncProd',
  'createAdminInfisicalSyncStaging',
  'createAdminInfisicalSyncPreview',
  'storeProdAdminUrls',
  'storeStagingAdminUrls',
  'createSuperadminProject',
  'configureSuperadminRootDirectory',
  'createSuperadminStagingEnvironment',
  'linkSuperadminGitHub',
  'configureSuperadminBranches',
  'createSuperadminInfisicalSyncProd',
  'createSuperadminInfisicalSyncStaging',
  'createSuperadminInfisicalSyncPreview',
  'storeProdSuperadminUrls',
  'storeStagingSuperadminUrls',
  'deployProduction',
] as const;

const RAILWAY_POSTGRES_PROGRESS_KEYS = [
  'ensureProdPostgresService',
  'captureProdPostgresVolume',
  'renameProdPostgresService',
  'renameProdPostgresVolume',
  'storeProdPostgresUrl',
  'ensureStagingPostgresService',
  'captureStagingPostgresVolume',
  'renameStagingPostgresService',
  'renameStagingPostgresVolume',
  'storeStagingPostgresUrl',
] as const;

const RAILWAY_BUCKETS_PROGRESS_KEYS = [
  'ensureProdSystemBucket',
  'ensureProdUserBucket',
  'storeProdCredentials',
  'ensureStagingSystemBucket',
  'ensureStagingUserBucket',
  'storeStagingCredentials',
] as const;

const CLOUDFLARE_PAGES_PROGRESS_KEYS = [
  'selectAccount',
  'storeApiToken',
  'createWebProject',
  'linkWebGitHub',
  'syncWebEnvProd',
  'syncWebEnvStaging',
  'createAdminProject',
  'linkAdminGitHub',
  'syncAdminEnvProd',
  'syncAdminEnvStaging',
  'createSuperadminProject',
  'linkSuperadminGitHub',
  'syncSuperadminEnvProd',
  'syncSuperadminEnvStaging',
] as const;

export const PROGRESS_KEYS = {
  project: PROJECT_PROGRESS_KEYS,
  infisical: INFISICAL_PROGRESS_KEYS,
  planetscale: PLANETSCALE_PROGRESS_KEYS,
  railway: RAILWAY_PROGRESS_KEYS,
  railwayPostgres: RAILWAY_POSTGRES_PROGRESS_KEYS,
  railwayBuckets: RAILWAY_BUCKETS_PROGRESS_KEYS,
  cloudflarePages: CLOUDFLARE_PAGES_PROGRESS_KEYS,
  resend: RESEND_PROGRESS_KEYS,
  bouncer: BOUNCER_PROGRESS_KEYS,
  vercel: VERCEL_PROGRESS_KEYS,
} as const;

type ProgressShape<Keys extends readonly string[]> = Record<Keys[number], boolean>;

// Each entry ORs together: a bare legacy key (single flag), or an array of
// legacy keys that must ALL be true (an AND group), matching the ad-hoc
// fallback logic each provider used before it was normalized to shape.
type LegacyFallback<Keys extends readonly string[]> = Partial<
  Record<Keys[number], readonly (string | readonly string[])[]>
>;

const makeDefaultProgress = <Keys extends readonly string[]>(keys: Keys): ProgressShape<Keys> =>
  Object.fromEntries(keys.map((key) => [key, false])) as ProgressShape<Keys>;

const normalizeProgress = <Keys extends readonly string[]>(
  keys: Keys,
  progress: Partial<Record<string, boolean>> | undefined,
  legacyFallback: LegacyFallback<Keys> = {},
): ProgressShape<Keys> => {
  const raw = progress ?? {};

  return Object.fromEntries(
    keys.map((key) => {
      const fallbacks = legacyFallback[key as Keys[number]] ?? [];
      const matchesLegacy = fallbacks.some((entry) =>
        Array.isArray(entry) ? entry.every((legacyKey) => raw[legacyKey] === true) : raw[entry as string] === true,
      );
      return [key, raw[key] === true || matchesLegacy];
    }),
  ) as ProgressShape<Keys>;
};

export type ProjectConfig = {
  monitoring?: { mode: 'off' | 'otlp' | 'split'; configProjectName: string; progress: Record<string, boolean> };
  launched: boolean;
  project: {
    name: string;
    organization: string;
    progress: ProgressShape<typeof PROJECT_PROGRESS_KEYS>;
  };
  infisical: {
    projectId: string;
    organizationId: string;
    organizationSlug: string;
    projectSlug: string;
    configProjectName: string;
    progress: ProgressShape<typeof INFISICAL_PROGRESS_KEYS>;
    error: string;
  };
  planetscale: {
    organization: string;
    region: string;
    database: string;
    tokenId: string;
    configProjectName: string;
    progress: ProgressShape<typeof PLANETSCALE_PROGRESS_KEYS>;
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
    progress: ProgressShape<typeof RAILWAY_PROGRESS_KEYS>;
    error: string;
  };
  resend: {
    provider: 'resend' | 'console';
    fromAddress: string;
    domainId: string;
    configProjectName: string;
    progress: ProgressShape<typeof RESEND_PROGRESS_KEYS>;
    error: string;
  };
  bouncer: {
    configProjectName: string;
    progress: ProgressShape<typeof BOUNCER_PROGRESS_KEYS>;
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
    progress: ProgressShape<typeof VERCEL_PROGRESS_KEYS>;
    error: string;
  };
  features: {
    staging: { enabled: boolean };
    apps: {
      web: { enabled: boolean };
      admin: { enabled: boolean };
      superadmin: { enabled: boolean };
    };
    /**
     * Controls whether init wires git-push → frontend-deploy auto-deploy.
     * When false, init skips Vercel/CF Pages → GitHub link steps and you
     * deploy via `vercel --prod` / `wrangler pages deploy`. Useful for:
     *   - Vercel Hobby + private org repo (paywalled git integration)
     *   - manual-promotion workflows (deploy via CI separately)
     *   - keeping the repo private without paying for Pro tier
     */
    gitConnectFrontend: { enabled: boolean };
  };
  railwayPostgres: {
    prodServiceId: string;
    prodVolumeId: string;
    stagingServiceId: string;
    stagingVolumeId: string;
    configProjectName: string;
    progress: ProgressShape<typeof RAILWAY_POSTGRES_PROGRESS_KEYS>;
    error: string;
  };
  railwayBuckets: {
    prodSystemServiceId: string;
    prodUserServiceId: string;
    stagingSystemServiceId: string;
    stagingUserServiceId: string;
    configProjectName: string;
    progress: ProgressShape<typeof RAILWAY_BUCKETS_PROGRESS_KEYS>;
    error: string;
  };
  cloudflarePages: {
    accountId: string;
    accountName: string;
    webProjectName: string;
    adminProjectName: string;
    superadminProjectName: string;
    configProjectName: string;
    progress: ProgressShape<typeof CLOUDFLARE_PAGES_PROGRESS_KEYS>;
    error: string;
  };
  providers: {
    frontend: FrontendProvider;
    database: DatabaseProvider;
    backend: BackendProvider;
    redis: RedisProvider;
    email: EmailProvider;
  };
};

export type FrontendProvider = 'vercel' | 'cloudflare-pages' | 'netlify';
export type DatabaseProvider = 'planetscale' | 'railway-postgres' | 'neon' | 'supabase';
export type BackendProvider = 'railway' | 'fly' | 'render';
export type RedisProvider = 'railway' | 'upstash';
export type EmailProvider = 'resend' | 'postmark' | 'ses' | 'none';

type LegacyProjectConfig = Partial<ProjectConfig> & {
  email?: ProjectConfig['resend'];
};

const defaultFeatures: ProjectConfig['features'] = {
  staging: { enabled: true },
  apps: {
    web: { enabled: true },
    admin: { enabled: true },
    superadmin: { enabled: true },
  },
  gitConnectFrontend: { enabled: true },
};

const defaultRailwayPostgresProgress = makeDefaultProgress(RAILWAY_POSTGRES_PROGRESS_KEYS);

const defaultRailwayPostgres: ProjectConfig['railwayPostgres'] = {
  prodServiceId: '',
  prodVolumeId: '',
  stagingServiceId: '',
  stagingVolumeId: '',
  configProjectName: '',
  progress: defaultRailwayPostgresProgress,
  error: '',
};

const defaultRailwayBucketsProgress = makeDefaultProgress(RAILWAY_BUCKETS_PROGRESS_KEYS);

const defaultRailwayBuckets: ProjectConfig['railwayBuckets'] = {
  prodSystemServiceId: '',
  prodUserServiceId: '',
  stagingSystemServiceId: '',
  stagingUserServiceId: '',
  configProjectName: '',
  progress: defaultRailwayBucketsProgress,
  error: '',
};

const defaultCloudflarePagesProgress = makeDefaultProgress(CLOUDFLARE_PAGES_PROGRESS_KEYS);

const defaultCloudflarePages: ProjectConfig['cloudflarePages'] = {
  accountId: '',
  accountName: '',
  webProjectName: '',
  adminProjectName: '',
  superadminProjectName: '',
  configProjectName: '',
  progress: defaultCloudflarePagesProgress,
  error: '',
};

const defaultProviders: ProjectConfig['providers'] = {
  frontend: 'vercel',
  database: 'planetscale',
  backend: 'railway',
  redis: 'railway',
  email: 'resend',
};

const defaultResendProgress = makeDefaultProgress(RESEND_PROGRESS_KEYS);

const RESEND_LEGACY_FALLBACK: LegacyFallback<typeof RESEND_PROGRESS_KEYS> = {
  storeApiKey: [['storeProdApiKey', 'storeStagingApiKey']],
  storeFromAddress: [['storeProdFromAddress', 'storeStagingFromAddress']],
};

const normalizeResendProgress = (
  progress: Partial<Record<string, boolean>> | undefined,
): ProjectConfig['resend']['progress'] => normalizeProgress(RESEND_PROGRESS_KEYS, progress, RESEND_LEGACY_FALLBACK);

const defaultBouncerProgress = makeDefaultProgress(BOUNCER_PROGRESS_KEYS);

const normalizeBouncerProgress = (
  progress: Partial<Record<string, boolean>> | undefined,
): ProjectConfig['bouncer']['progress'] => normalizeProgress(BOUNCER_PROGRESS_KEYS, progress);

const defaultInfisicalProgress = makeDefaultProgress(INFISICAL_PROGRESS_KEYS);

const INFISICAL_LEGACY_FALLBACK: LegacyFallback<typeof INFISICAL_PROGRESS_KEYS> = {
  // Legacy bundled flag fans out so older in-progress configs still resume cleanly.
  createRootApiFolder: ['createApps'],
  createRootWebFolder: ['createApps'],
  createRootAdminFolder: ['createApps'],
  createRootSuperadminFolder: ['createApps'],
  createStagingApiFolder: ['createApps'],
  createStagingWebFolder: ['createApps'],
  createStagingAdminFolder: ['createApps'],
  createStagingSuperadminFolder: ['createApps'],
  createProdApiFolder: ['createApps'],
  createProdWebFolder: ['createApps'],
  createProdAdminFolder: ['createApps'],
  createProdSuperadminFolder: ['createApps'],
  createStagingApiRootImport: ['setInheritance'],
  createStagingApiRootAppImport: ['setInheritance'],
  createStagingApiEnvImport: ['setInheritance'],
  createStagingWebRootImport: ['setInheritance'],
  createStagingWebRootAppImport: ['setInheritance'],
  createStagingWebEnvImport: ['setInheritance'],
  createStagingAdminRootImport: ['setInheritance'],
  createStagingAdminRootAppImport: ['setInheritance'],
  createStagingAdminEnvImport: ['setInheritance'],
  createStagingSuperadminRootImport: ['setInheritance'],
  createStagingSuperadminRootAppImport: ['setInheritance'],
  createStagingSuperadminEnvImport: ['setInheritance'],
  createProdApiRootImport: ['setInheritance'],
  createProdApiRootAppImport: ['setInheritance'],
  createProdApiEnvImport: ['setInheritance'],
  createProdWebRootImport: ['setInheritance'],
  createProdWebRootAppImport: ['setInheritance'],
  createProdWebEnvImport: ['setInheritance'],
  createProdAdminRootImport: ['setInheritance'],
  createProdAdminRootAppImport: ['setInheritance'],
  createProdAdminEnvImport: ['setInheritance'],
  createProdSuperadminRootImport: ['setInheritance'],
  createProdSuperadminRootAppImport: ['setInheritance'],
  createProdSuperadminEnvImport: ['setInheritance'],
  ensureProdApiAuthSecret: ['ensureApiAuthSecrets'],
  ensureStagingApiAuthSecret: ['ensureApiAuthSecrets'],
};

const normalizeInfisicalProgress = (
  progress: Partial<Record<string, boolean>> | undefined,
): ProjectConfig['infisical']['progress'] =>
  normalizeProgress(INFISICAL_PROGRESS_KEYS, progress, INFISICAL_LEGACY_FALLBACK);

const defaultPlanetScaleProgress = makeDefaultProgress(PLANETSCALE_PROGRESS_KEYS);

const defaultRailwayProgress = makeDefaultProgress(RAILWAY_PROGRESS_KEYS);

const defaultVercelProgress = makeDefaultProgress(VERCEL_PROGRESS_KEYS);

const VERCEL_LEGACY_SYNC_KEYS = [
  'createWebInfisicalSyncProd',
  'createWebInfisicalSyncStaging',
  'createWebInfisicalSyncPreview',
  'createAdminInfisicalSyncProd',
  'createAdminInfisicalSyncStaging',
  'createAdminInfisicalSyncPreview',
  'createSuperadminInfisicalSyncProd',
  'createSuperadminInfisicalSyncStaging',
  'createSuperadminInfisicalSyncPreview',
  'deployProduction',
] as const;

const VERCEL_LEGACY_FALLBACK: LegacyFallback<typeof VERCEL_PROGRESS_KEYS> = {
  storeTeamIdSecret: ['selectTeam'],
  storeTeamNameSecret: ['selectTeam'],
  storeVercelToken: VERCEL_LEGACY_SYNC_KEYS,
  createInfisicalConnection: VERCEL_LEGACY_SYNC_KEYS,
};

const normalizeVercelProgress = (
  progress: Partial<Record<string, boolean>> | undefined,
): ProjectConfig['vercel']['progress'] => normalizeProgress(VERCEL_PROGRESS_KEYS, progress, VERCEL_LEGACY_FALLBACK);

const RAILWAY_LEGACY_FALLBACK: LegacyFallback<typeof RAILWAY_PROGRESS_KEYS> = {
  ensureProdEnvironment: ['renameProductionEnv'],
  storeProdEnvironmentIdSecret: ['renameProductionEnv'],
  deleteLegacyProductionEnvironment: ['renameProductionEnv'],
  ensureStagingEnvironment: ['createStagingEnv'],
  storeStagingEnvironmentIdSecret: ['createStagingEnv'],
  ensureProdRedisService: ['createRedisProd'],
  captureProdRedisVolume: ['createRedisProd'],
  renameProdRedisService: ['renameRedisProd'],
  renameProdRedisVolume: ['renameRedisProdVolume'],
  storeProdRedisUrl: ['storeRedisUrl'],
  ensureStagingRedisService: ['createRedisStaging'],
  captureStagingRedisVolume: ['createRedisStaging'],
  renameStagingRedisService: ['renameRedisStaging'],
  renameStagingRedisVolume: ['renameRedisStagingVolume'],
  storeStagingRedisUrl: ['storeRedisUrl'],
  ensureProdApiService: ['createApiProd'],
  storeProdApiServiceIdSecret: ['createApiProd'],
  configureProdApiService: ['connectApiProdGithub'],
  connectProdApiGithub: ['connectApiProdGithub'],
  ensureProdApiDeployment: ['connectApiProdGithub', 'verifyDeployment'],
  ensureStagingApiService: ['createApiStaging'],
  storeStagingApiServiceIdSecret: ['createApiStaging'],
  configureStagingApiService: ['connectApiStagingGithub'],
  connectStagingApiGithub: ['connectApiStagingGithub'],
  ensureStagingApiDeployment: ['connectApiStagingGithub', 'verifyDeployment'],
  storeProdApiUrl: ['storeApiUrl'],
  storeStagingApiUrl: ['storeApiUrl'],
  ensureProdWorkerService: ['createWorkerProd'],
  storeProdWorkerServiceIdSecret: ['createWorkerProd'],
  createInfisicalSyncProdWorker: ['connectWorkerProdGithub', 'verifyDeployment'],
  configureProdWorkerService: ['connectWorkerProdGithub'],
  connectProdWorkerGithub: ['connectWorkerProdGithub'],
  ensureProdWorkerDeployment: ['connectWorkerProdGithub', 'verifyDeployment'],
  ensureStagingWorkerService: ['createWorkerStaging'],
  storeStagingWorkerServiceIdSecret: ['createWorkerStaging'],
  createInfisicalSyncStagingWorker: ['connectWorkerStagingGithub', 'verifyDeployment'],
  configureStagingWorkerService: ['connectWorkerStagingGithub'],
  connectStagingWorkerGithub: ['connectWorkerStagingGithub'],
  ensureStagingWorkerDeployment: ['connectWorkerStagingGithub', 'verifyDeployment'],
};

const normalizeRailwayProgress = (
  progress: Partial<Record<string, boolean>> | undefined,
): ProjectConfig['railway']['progress'] => normalizeProgress(RAILWAY_PROGRESS_KEYS, progress, RAILWAY_LEGACY_FALLBACK);

const PLANETSCALE_LEGACY_FALLBACK: LegacyFallback<typeof PLANETSCALE_PROGRESS_KEYS> = {
  recordTokenId: ['createToken'],
  storeOrganizationSecret: ['setInfisicalToken'],
  storeRegionSecret: ['setInfisicalToken'],
  storeTokenIdSecret: ['setInfisicalToken'],
  storeTokenSecret: ['setInfisicalToken'],
  // Legacy bundled flags fan out to the new atomic flags so existing in-progress configs still resume correctly.
  createProdRole: ['createPasswords'],
  createStagingRole: ['createPasswords'],
  storeProdConnectionString: ['storeConnectionStrings'],
  storeStagingConnectionString: ['storeConnectionStrings'],
  initProdMigrationTable: ['initMigrationTable'],
  initStagingMigrationTable: ['initMigrationTable'],
};

const normalizePlanetScaleProgress = (
  progress: Partial<Record<string, boolean>> | undefined,
): ProjectConfig['planetscale']['progress'] =>
  normalizeProgress(PLANETSCALE_PROGRESS_KEYS, progress, PLANETSCALE_LEGACY_FALLBACK);

/**
 * Get the project configuration based on USE_INTERNAL_CONFIG env var
 *
 * - USE_INTERNAL_CONFIG=true -> project.config.template-internal.ts
 * - Otherwise -> project.config.ts
 */
export const getProjectConfig = async (): Promise<ProjectConfig> => {
  const useInternal = process.env.USE_INTERNAL_CONFIG === 'true';
  let configFile = useInternal ? 'project.config.template-internal.ts' : 'project.config.ts';
  let configPath = join(process.cwd(), configFile);

  // Graceful fallback: if USE_INTERNAL_CONFIG=true but the internal file is missing
  // (the common case for template consumers — internal config is only for template
  // development), fall back to the regular project.config.ts instead of crashing.
  if (useInternal && !existsSync(configPath)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[init] USE_INTERNAL_CONFIG=true but ${configFile} not found — falling back to project.config.ts. ` +
        `Set USE_INTERNAL_CONFIG=false in .env.init to silence this warning.`,
    );
    configFile = 'project.config.ts';
    configPath = join(process.cwd(), configFile);
  }

  try {
    // Bust import cache with monotonic counter (Date.now() has ms resolution
    // and sequential markComplete calls in a tight loop hit the same value,
    // so dynamic import returns the cached stale module and the writes get
    // sequenced against pre-write state, losing earlier writes).
    cacheBustCounter += 1;
    const module = await import(`${configPath}?n=${cacheBustCounter}`);
    const config = module.projectConfig as LegacyProjectConfig;
    const resendConfig = config.resend ?? config.email;

    return {
      monitoring: config.monitoring,
      launched: config.launched ?? false,
      project: {
        name: config.project?.name ?? 'template',
        organization: config.project?.organization ?? '',
        progress: normalizeProgress(PROJECT_PROGRESS_KEYS, config.project?.progress),
      },
      resend: {
        provider: resendConfig?.provider ?? 'resend',
        fromAddress: resendConfig?.fromAddress ?? '',
        domainId: resendConfig?.domainId ?? '',
        configProjectName: resendConfig?.configProjectName ?? '',
        progress: normalizeResendProgress(resendConfig?.progress),
        error: resendConfig?.error ?? '',
      },
      bouncer: {
        configProjectName: (config as Record<string, unknown>).bouncer
          ? (((config as Record<string, unknown>).bouncer as Record<string, string>).configProjectName ?? '')
          : '',
        progress: normalizeBouncerProgress(
          ((config as Record<string, unknown>).bouncer as Record<string, unknown>)?.progress as
            | Partial<Record<string, boolean>>
            | undefined,
        ),
        error: (config as Record<string, unknown>).bouncer
          ? (((config as Record<string, unknown>).bouncer as Record<string, string>).error ?? '')
          : '',
      },
      infisical: {
        projectId: config.infisical?.projectId ?? '',
        organizationId: config.infisical?.organizationId ?? '',
        organizationSlug: config.infisical?.organizationSlug ?? '',
        projectSlug: config.infisical?.projectSlug ?? '',
        configProjectName: config.infisical?.configProjectName ?? '',
        progress: normalizeInfisicalProgress(config.infisical?.progress),
        error: config.infisical?.error ?? '',
      },
      planetscale: {
        organization: config.planetscale?.organization ?? '',
        region: config.planetscale?.region ?? '',
        database: config.planetscale?.database ?? '',
        tokenId: config.planetscale?.tokenId ?? '',
        configProjectName: config.planetscale?.configProjectName ?? '',
        progress: normalizePlanetScaleProgress(config.planetscale?.progress),
        error: config.planetscale?.error ?? '',
      },
      railway: {
        projectId: config.railway?.projectId ?? '',
        workspaceId: config.railway?.workspaceId ?? '',
        prodEnvironmentId: config.railway?.prodEnvironmentId ?? '',
        stagingEnvironmentId: config.railway?.stagingEnvironmentId ?? '',
        prodApiServiceId: config.railway?.prodApiServiceId ?? '',
        stagingApiServiceId: config.railway?.stagingApiServiceId ?? '',
        prodWorkerServiceId: config.railway?.prodWorkerServiceId ?? '',
        stagingWorkerServiceId: config.railway?.stagingWorkerServiceId ?? '',
        prodRedisServiceId: config.railway?.prodRedisServiceId ?? '',
        stagingRedisServiceId: config.railway?.stagingRedisServiceId ?? '',
        prodRedisVolumeId: config.railway?.prodRedisVolumeId ?? '',
        stagingRedisVolumeId: config.railway?.stagingRedisVolumeId ?? '',
        configProjectName: config.railway?.configProjectName ?? '',
        progress: normalizeRailwayProgress(config.railway?.progress),
        error: config.railway?.error ?? '',
      },
      vercel: {
        teamId: config.vercel?.teamId ?? '',
        teamName: config.vercel?.teamName ?? '',
        connectionId: config.vercel?.connectionId ?? '',
        webProjectId: config.vercel?.webProjectId ?? '',
        adminProjectId: config.vercel?.adminProjectId ?? '',
        superadminProjectId: config.vercel?.superadminProjectId ?? '',
        configProjectName: config.vercel?.configProjectName ?? '',
        progress: normalizeVercelProgress(config.vercel?.progress),
        error: config.vercel?.error ?? '',
      },
      features: {
        staging: {
          enabled: (config.features?.staging?.enabled ?? defaultFeatures.staging.enabled) === true,
        },
        apps: {
          web: {
            enabled: (config.features?.apps?.web?.enabled ?? defaultFeatures.apps.web.enabled) === true,
          },
          admin: {
            enabled: (config.features?.apps?.admin?.enabled ?? defaultFeatures.apps.admin.enabled) === true,
          },
          superadmin: {
            enabled: (config.features?.apps?.superadmin?.enabled ?? defaultFeatures.apps.superadmin.enabled) === true,
          },
        },
        gitConnectFrontend: {
          enabled:
            (config.features?.gitConnectFrontend?.enabled ?? defaultFeatures.gitConnectFrontend.enabled) === true,
        },
      },
      providers: {
        frontend: config.providers?.frontend ?? defaultProviders.frontend,
        database: config.providers?.database ?? defaultProviders.database,
        backend: config.providers?.backend ?? defaultProviders.backend,
        redis: config.providers?.redis ?? defaultProviders.redis,
        email: config.providers?.email ?? defaultProviders.email,
      },
      railwayPostgres: {
        prodServiceId: config.railwayPostgres?.prodServiceId ?? '',
        prodVolumeId: config.railwayPostgres?.prodVolumeId ?? '',
        stagingServiceId: config.railwayPostgres?.stagingServiceId ?? '',
        stagingVolumeId: config.railwayPostgres?.stagingVolumeId ?? '',
        configProjectName: config.railwayPostgres?.configProjectName ?? '',
        progress: {
          ...defaultRailwayPostgresProgress,
          ...(config.railwayPostgres?.progress ?? {}),
        },
        error: config.railwayPostgres?.error ?? '',
      },
      railwayBuckets: {
        prodSystemServiceId: config.railwayBuckets?.prodSystemServiceId ?? '',
        prodUserServiceId: config.railwayBuckets?.prodUserServiceId ?? '',
        stagingSystemServiceId: config.railwayBuckets?.stagingSystemServiceId ?? '',
        stagingUserServiceId: config.railwayBuckets?.stagingUserServiceId ?? '',
        configProjectName: config.railwayBuckets?.configProjectName ?? '',
        progress: {
          ...defaultRailwayBucketsProgress,
          ...(config.railwayBuckets?.progress ?? {}),
        },
        error: config.railwayBuckets?.error ?? '',
      },
      cloudflarePages: {
        accountId: config.cloudflarePages?.accountId ?? '',
        accountName: config.cloudflarePages?.accountName ?? '',
        webProjectName: config.cloudflarePages?.webProjectName ?? '',
        adminProjectName: config.cloudflarePages?.adminProjectName ?? '',
        superadminProjectName: config.cloudflarePages?.superadminProjectName ?? '',
        configProjectName: config.cloudflarePages?.configProjectName ?? '',
        progress: {
          ...defaultCloudflarePagesProgress,
          ...(config.cloudflarePages?.progress ?? {}),
        },
        error: config.cloudflarePages?.error ?? '',
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
  const internalPath = join(process.cwd(), 'project.config.template-internal.ts');
  // Same fallback as getProjectConfig: prefer internal only when it actually exists.
  if (useInternal && existsSync(internalPath)) return internalPath;
  return join(process.cwd(), 'project.config.ts');
};

/**
 * Write the project configuration back to file
 */
export const writeProjectConfig = async (config: ProjectConfig): Promise<void> => {
  const { writeFileSync } = await import('node:fs');
  const configPath = getProjectConfigPath();
  const { email: _legacyEmail, ...restConfig } = config as ProjectConfig & {
    email?: ProjectConfig['resend'];
  };

  const normalizedConfig: ProjectConfig = {
    ...restConfig,
    resend: {
      ...config.resend,
      progress: {
        ...defaultResendProgress,
        ...config.resend.progress,
      },
    },
    bouncer: {
      ...config.bouncer,
      progress: {
        ...defaultBouncerProgress,
        ...config.bouncer.progress,
      },
    },
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
    features: {
      staging: {
        enabled: (config.features?.staging?.enabled ?? defaultFeatures.staging.enabled) === true,
      },
      apps: {
        web: {
          enabled: (config.features?.apps?.web?.enabled ?? defaultFeatures.apps.web.enabled) === true,
        },
        admin: {
          enabled: (config.features?.apps?.admin?.enabled ?? defaultFeatures.apps.admin.enabled) === true,
        },
        superadmin: {
          enabled: (config.features?.apps?.superadmin?.enabled ?? defaultFeatures.apps.superadmin.enabled) === true,
        },
      },
      gitConnectFrontend: {
        enabled: (config.features?.gitConnectFrontend?.enabled ?? defaultFeatures.gitConnectFrontend.enabled) === true,
      },
    },
    providers: {
      frontend: config.providers?.frontend ?? defaultProviders.frontend,
      database: config.providers?.database ?? defaultProviders.database,
      backend: config.providers?.backend ?? defaultProviders.backend,
      redis: config.providers?.redis ?? defaultProviders.redis,
      email: config.providers?.email ?? defaultProviders.email,
    },
    railwayPostgres: {
      ...defaultRailwayPostgres,
      ...(config.railwayPostgres ?? {}),
      progress: {
        ...defaultRailwayPostgresProgress,
        ...(config.railwayPostgres?.progress ?? {}),
      },
    },
    railwayBuckets: {
      ...defaultRailwayBuckets,
      ...(config.railwayBuckets ?? {}),
      progress: {
        ...defaultRailwayBucketsProgress,
        ...(config.railwayBuckets?.progress ?? {}),
      },
    },
    cloudflarePages: {
      ...defaultCloudflarePages,
      ...(config.cloudflarePages ?? {}),
      progress: {
        ...defaultCloudflarePagesProgress,
        ...(config.cloudflarePages?.progress ?? {}),
      },
    },
  };

  // Stringify with tabs for indentation
  const configJson = JSON.stringify(normalizedConfig, null, '\t');

  // Wrap in TypeScript boilerplate
  const content = `export const projectConfig = ${configJson} as const;\n\nexport type ProjectConfig = typeof projectConfig;\n`;

  writeFileSync(configPath, content, 'utf-8');
};
