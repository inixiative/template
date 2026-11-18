import type { ProjectConfig } from '../utils/fetchProjectConfig';
import type { InfisicalAction } from '../utils/progressTracking';

type InfisicalProgress = Partial<Record<InfisicalAction, boolean>>;

type InfisicalProgressGroup = {
  actions: readonly InfisicalAction[];
  labelFor: (config: ProjectConfig, completedCount: number, totalCount: number) => string;
};

const countCompletedActions = (
  progress: InfisicalProgress,
  actions: readonly InfisicalAction[],
): number => {
  return actions.filter((action) => progress[action]).length;
};

const countLabel =
  (label: string) =>
  (_config: ProjectConfig, completedCount: number, totalCount: number): string => {
    return `${label} (${completedCount}/${totalCount})`;
  };

export const infisicalFolderSteps = [
  { action: 'createRootApiFolder', environment: 'root', app: 'api' },
  { action: 'createRootWebFolder', environment: 'root', app: 'web' },
  { action: 'createRootAdminFolder', environment: 'root', app: 'admin' },
  { action: 'createRootSuperadminFolder', environment: 'root', app: 'superadmin' },
  { action: 'createStagingApiFolder', environment: 'staging', app: 'api' },
  { action: 'createStagingWebFolder', environment: 'staging', app: 'web' },
  { action: 'createStagingAdminFolder', environment: 'staging', app: 'admin' },
  { action: 'createStagingSuperadminFolder', environment: 'staging', app: 'superadmin' },
  { action: 'createProdApiFolder', environment: 'prod', app: 'api' },
  { action: 'createProdWebFolder', environment: 'prod', app: 'web' },
  { action: 'createProdAdminFolder', environment: 'prod', app: 'admin' },
  { action: 'createProdSuperadminFolder', environment: 'prod', app: 'superadmin' },
] as const;

export const infisicalInheritanceSteps = [
  {
    action: 'createStagingApiRootImport',
    destinationEnvironment: 'staging',
    destinationPath: '/api',
    sourceEnvironment: 'root',
    sourcePath: '/',
  },
  {
    action: 'createStagingApiRootAppImport',
    destinationEnvironment: 'staging',
    destinationPath: '/api',
    sourceEnvironment: 'root',
    sourcePath: '/api',
  },
  {
    action: 'createStagingApiEnvImport',
    destinationEnvironment: 'staging',
    destinationPath: '/api',
    sourceEnvironment: 'staging',
    sourcePath: '/',
  },
  {
    action: 'createStagingWebRootImport',
    destinationEnvironment: 'staging',
    destinationPath: '/web',
    sourceEnvironment: 'root',
    sourcePath: '/',
  },
  {
    action: 'createStagingWebRootAppImport',
    destinationEnvironment: 'staging',
    destinationPath: '/web',
    sourceEnvironment: 'root',
    sourcePath: '/web',
  },
  {
    action: 'createStagingWebEnvImport',
    destinationEnvironment: 'staging',
    destinationPath: '/web',
    sourceEnvironment: 'staging',
    sourcePath: '/',
  },
  {
    action: 'createStagingAdminRootImport',
    destinationEnvironment: 'staging',
    destinationPath: '/admin',
    sourceEnvironment: 'root',
    sourcePath: '/',
  },
  {
    action: 'createStagingAdminRootAppImport',
    destinationEnvironment: 'staging',
    destinationPath: '/admin',
    sourceEnvironment: 'root',
    sourcePath: '/admin',
  },
  {
    action: 'createStagingAdminEnvImport',
    destinationEnvironment: 'staging',
    destinationPath: '/admin',
    sourceEnvironment: 'staging',
    sourcePath: '/',
  },
  {
    action: 'createStagingSuperadminRootImport',
    destinationEnvironment: 'staging',
    destinationPath: '/superadmin',
    sourceEnvironment: 'root',
    sourcePath: '/',
  },
  {
    action: 'createStagingSuperadminRootAppImport',
    destinationEnvironment: 'staging',
    destinationPath: '/superadmin',
    sourceEnvironment: 'root',
    sourcePath: '/superadmin',
  },
  {
    action: 'createStagingSuperadminEnvImport',
    destinationEnvironment: 'staging',
    destinationPath: '/superadmin',
    sourceEnvironment: 'staging',
    sourcePath: '/',
  },
  {
    action: 'createProdApiRootImport',
    destinationEnvironment: 'prod',
    destinationPath: '/api',
    sourceEnvironment: 'root',
    sourcePath: '/',
  },
  {
    action: 'createProdApiRootAppImport',
    destinationEnvironment: 'prod',
    destinationPath: '/api',
    sourceEnvironment: 'root',
    sourcePath: '/api',
  },
  {
    action: 'createProdApiEnvImport',
    destinationEnvironment: 'prod',
    destinationPath: '/api',
    sourceEnvironment: 'prod',
    sourcePath: '/',
  },
  {
    action: 'createProdWebRootImport',
    destinationEnvironment: 'prod',
    destinationPath: '/web',
    sourceEnvironment: 'root',
    sourcePath: '/',
  },
  {
    action: 'createProdWebRootAppImport',
    destinationEnvironment: 'prod',
    destinationPath: '/web',
    sourceEnvironment: 'root',
    sourcePath: '/web',
  },
  {
    action: 'createProdWebEnvImport',
    destinationEnvironment: 'prod',
    destinationPath: '/web',
    sourceEnvironment: 'prod',
    sourcePath: '/',
  },
  {
    action: 'createProdAdminRootImport',
    destinationEnvironment: 'prod',
    destinationPath: '/admin',
    sourceEnvironment: 'root',
    sourcePath: '/',
  },
  {
    action: 'createProdAdminRootAppImport',
    destinationEnvironment: 'prod',
    destinationPath: '/admin',
    sourceEnvironment: 'root',
    sourcePath: '/admin',
  },
  {
    action: 'createProdAdminEnvImport',
    destinationEnvironment: 'prod',
    destinationPath: '/admin',
    sourceEnvironment: 'prod',
    sourcePath: '/',
  },
  {
    action: 'createProdSuperadminRootImport',
    destinationEnvironment: 'prod',
    destinationPath: '/superadmin',
    sourceEnvironment: 'root',
    sourcePath: '/',
  },
  {
    action: 'createProdSuperadminRootAppImport',
    destinationEnvironment: 'prod',
    destinationPath: '/superadmin',
    sourceEnvironment: 'root',
    sourcePath: '/superadmin',
  },
  {
    action: 'createProdSuperadminEnvImport',
    destinationEnvironment: 'prod',
    destinationPath: '/superadmin',
    sourceEnvironment: 'prod',
    sourcePath: '/',
  },
] as const;

export const infisicalIdentitySecretSteps = [
  {
    action: 'storeProjectNameSecret',
    key: 'PROJECT_NAME',
    valueFor: (config: ProjectConfig) => config.project.name,
    path: '/',
  },
  {
    action: 'storeViteProjectNameSecret',
    key: 'VITE_PROJECT_NAME',
    valueFor: (config: ProjectConfig) => config.project.name,
    path: '/',
  },
  {
    action: 'storeViteAppShortNameSecret',
    key: 'VITE_APP_SHORT_NAME',
    valueFor: (config: ProjectConfig) => config.project.name,
    path: '/',
  },
] as const;

export const infisicalAppNameSecretSteps = [
  { action: 'storeWebAppNameSecret', value: 'Web', path: '/web' },
  { action: 'storeAdminAppNameSecret', value: 'Admin', path: '/admin' },
  { action: 'storeSuperadminAppNameSecret', value: 'Superadmin', path: '/superadmin' },
] as const;

export const infisicalApiAuthSecretSteps = [
  { action: 'ensureProdApiAuthSecret', environment: 'prod' },
  { action: 'ensureStagingApiAuthSecret', environment: 'staging' },
] as const;

export const infisicalWebhookSigningSteps = [
  { action: 'ensureProdWebhookSigningKeys', environment: 'prod' },
  { action: 'ensureStagingWebhookSigningKeys', environment: 'staging' },
] as const;

// One step per env; the per-prefix iteration over ENCRYPTED_MODELS happens
// inside the setup loop so adding a new encrypted model picks up automatically.
export const infisicalEncryptionKeySteps = [
  { action: 'ensureProdEncryptionKeys', environment: 'prod' },
  { action: 'ensureStagingEncryptionKeys', environment: 'staging' },
] as const;

const infisicalProgressGroups: readonly InfisicalProgressGroup[] = [
  {
    actions: ['selectOrg'],
    labelFor: (config) =>
      config.infisical.organizationSlug
        ? `Organization selected: ${config.infisical.organizationSlug}`
        : 'Organization selected',
  },
  {
    actions: ['createProject'],
    labelFor: (config) =>
      config.infisical.projectSlug
        ? `Project created: ${config.infisical.projectSlug}`
        : 'Project created',
  },
  {
    actions: ['renameEnv'],
    labelFor: () => 'Environments configured',
  },
  {
    actions: infisicalFolderSteps
      .filter((step) => step.environment === 'root')
      .map((step) => step.action),
    labelFor: countLabel('Root app folders created'),
  },
  {
    actions: infisicalFolderSteps
      .filter((step) => step.environment === 'staging')
      .map((step) => step.action),
    labelFor: countLabel('Staging app folders created'),
  },
  {
    actions: infisicalFolderSteps
      .filter((step) => step.environment === 'prod')
      .map((step) => step.action),
    labelFor: countLabel('Production app folders created'),
  },
  {
    actions: infisicalInheritanceSteps
      .filter((step) => step.destinationEnvironment === 'staging')
      .map((step) => step.action),
    labelFor: countLabel('Staging inheritance chains configured'),
  },
  {
    actions: infisicalInheritanceSteps
      .filter((step) => step.destinationEnvironment === 'prod')
      .map((step) => step.action),
    labelFor: countLabel('Production inheritance chains configured'),
  },
  {
    actions: infisicalIdentitySecretSteps.map((step) => step.action),
    labelFor: countLabel('Shared app identity secrets stored'),
  },
  {
    actions: infisicalAppNameSecretSteps.map((step) => step.action),
    labelFor: countLabel('Per-app display names stored'),
  },
  {
    actions: ['ensureProdApiAuthSecret'],
    labelFor: () => 'Production API auth secret initialized',
  },
  {
    actions: ['ensureStagingApiAuthSecret'],
    labelFor: () => 'Staging API auth secret initialized',
  },
  {
    actions: ['ensureProdWebhookSigningKeys'],
    labelFor: () => 'Production webhook signing keypair initialized',
  },
  {
    actions: ['ensureStagingWebhookSigningKeys'],
    labelFor: () => 'Staging webhook signing keypair initialized',
  },
  {
    actions: ['ensureProdEncryptionKeys'],
    labelFor: () => 'Production encryption keys initialized',
  },
  {
    actions: ['ensureStagingEncryptionKeys'],
    labelFor: () => 'Staging encryption keys initialized',
  },
] as const;

export type InfisicalProgressSummary = {
  label: string;
  completed: boolean;
  completedCount: number;
  totalCount: number;
};

export const infisicalProgressSummaries = (config: ProjectConfig): InfisicalProgressSummary[] => {
  return infisicalProgressGroups.map((group) => {
    const completedCount = countCompletedActions(config.infisical.progress, group.actions);
    const totalCount = group.actions.length;
    return {
      label: group.labelFor(config, completedCount, totalCount),
      completed: completedCount === totalCount,
      completedCount,
      totalCount,
    };
  });
};
