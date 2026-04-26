import type { ProjectConfig } from '../utils/getProjectConfig';
import type { VercelAction } from '../utils/progressTracking';

type VercelProgress = ProjectConfig['vercel']['progress'];

type VercelProgressItem = {
  action: VercelAction;
  getLabel: (config: ProjectConfig) => string;
};

type VercelProgressGroup = {
  actions: readonly VercelAction[];
  getLabel: (config: ProjectConfig, completedCount: number, totalCount: number) => string;
};

const countCompletedActions = (progress: VercelProgress, actions: readonly VercelAction[]): number => {
  return actions.filter((action) => progress[action]).length;
};

const vercelBootstrapActions = [
  'selectTeam',
  'storeTeamIdSecret',
  'storeTeamNameSecret',
  'promptedForGithub',
  'storeVercelToken',
  'createInfisicalConnection',
] as const satisfies readonly VercelAction[];

const vercelWebSteps: readonly VercelProgressItem[] = [
  {
    action: 'createWebProject',
    getLabel: (config) =>
      config.vercel.webProjectId ? `Web: Project created (${config.vercel.webProjectId})` : 'Web: Project created',
  },
  {
    action: 'configureWebRootDirectory',
    getLabel: () => 'Web: Root directory configured',
  },
  {
    action: 'createWebStagingEnvironment',
    getLabel: () => 'Web: Staging environment created',
  },
  {
    action: 'linkWebGitHub',
    getLabel: () => 'Web: GitHub linked',
  },
  {
    action: 'configureWebBranches',
    getLabel: () => 'Web: Branches configured',
  },
  {
    action: 'createWebInfisicalSyncProd',
    getLabel: () => 'Web: Infisical sync → production',
  },
  {
    action: 'createWebInfisicalSyncStaging',
    getLabel: () => 'Web: Infisical sync → staging',
  },
  {
    action: 'createWebInfisicalSyncPreview',
    getLabel: () => 'Web: Infisical sync → preview',
  },
  {
    action: 'storeProdWebUrls',
    getLabel: () => 'Web: Production URLs stored',
  },
  {
    action: 'storeStagingWebUrls',
    getLabel: () => 'Web: Staging URLs stored',
  },
];

const vercelAdminSteps: readonly VercelProgressItem[] = [
  {
    action: 'createAdminProject',
    getLabel: (config) =>
      config.vercel.adminProjectId
        ? `Admin: Project created (${config.vercel.adminProjectId})`
        : 'Admin: Project created',
  },
  {
    action: 'configureAdminRootDirectory',
    getLabel: () => 'Admin: Root directory configured',
  },
  {
    action: 'createAdminStagingEnvironment',
    getLabel: () => 'Admin: Staging environment created',
  },
  {
    action: 'linkAdminGitHub',
    getLabel: () => 'Admin: GitHub linked',
  },
  {
    action: 'configureAdminBranches',
    getLabel: () => 'Admin: Branches configured',
  },
  {
    action: 'createAdminInfisicalSyncProd',
    getLabel: () => 'Admin: Infisical sync → production',
  },
  {
    action: 'createAdminInfisicalSyncStaging',
    getLabel: () => 'Admin: Infisical sync → staging',
  },
  {
    action: 'createAdminInfisicalSyncPreview',
    getLabel: () => 'Admin: Infisical sync → preview',
  },
  {
    action: 'storeProdAdminUrls',
    getLabel: () => 'Admin: Production URLs stored',
  },
  {
    action: 'storeStagingAdminUrls',
    getLabel: () => 'Admin: Staging URLs stored',
  },
];

const vercelSuperadminSteps: readonly VercelProgressItem[] = [
  {
    action: 'createSuperadminProject',
    getLabel: (config) =>
      config.vercel.superadminProjectId
        ? `Superadmin: Project created (${config.vercel.superadminProjectId})`
        : 'Superadmin: Project created',
  },
  {
    action: 'configureSuperadminRootDirectory',
    getLabel: () => 'Superadmin: Root directory configured',
  },
  {
    action: 'createSuperadminStagingEnvironment',
    getLabel: () => 'Superadmin: Staging environment created',
  },
  {
    action: 'linkSuperadminGitHub',
    getLabel: () => 'Superadmin: GitHub linked',
  },
  {
    action: 'configureSuperadminBranches',
    getLabel: () => 'Superadmin: Branches configured',
  },
  {
    action: 'createSuperadminInfisicalSyncProd',
    getLabel: () => 'Superadmin: Infisical sync → production',
  },
  {
    action: 'createSuperadminInfisicalSyncStaging',
    getLabel: () => 'Superadmin: Infisical sync → staging',
  },
  {
    action: 'createSuperadminInfisicalSyncPreview',
    getLabel: () => 'Superadmin: Infisical sync → preview',
  },
  {
    action: 'storeProdSuperadminUrls',
    getLabel: () => 'Superadmin: Production URLs stored',
  },
  {
    action: 'storeStagingSuperadminUrls',
    getLabel: () => 'Superadmin: Staging URLs stored',
  },
];

const vercelProgressGroups: readonly VercelProgressGroup[] = [
  {
    actions: vercelBootstrapActions,
    getLabel: (config, completedCount, totalCount) =>
      config.vercel.teamId || config.vercel.connectionId
        ? `Bootstrap ready (${completedCount}/${totalCount}): ${config.vercel.teamId ?? 'team selected'}`
        : `Bootstrap ready (${completedCount}/${totalCount})`,
  },
  {
    actions: vercelWebSteps.map((step) => step.action),
    getLabel: (config, completedCount, totalCount) =>
      config.vercel.webProjectId
        ? `Web ready (${completedCount}/${totalCount}): ${config.vercel.webProjectId}`
        : `Web ready (${completedCount}/${totalCount})`,
  },
  {
    actions: vercelAdminSteps.map((step) => step.action),
    getLabel: (config, completedCount, totalCount) =>
      config.vercel.adminProjectId
        ? `Admin ready (${completedCount}/${totalCount}): ${config.vercel.adminProjectId}`
        : `Admin ready (${completedCount}/${totalCount})`,
  },
  {
    actions: vercelSuperadminSteps.map((step) => step.action),
    getLabel: (config, completedCount, totalCount) =>
      config.vercel.superadminProjectId
        ? `Superadmin ready (${completedCount}/${totalCount}): ${config.vercel.superadminProjectId}`
        : `Superadmin ready (${completedCount}/${totalCount})`,
  },
  {
    actions: ['deployProduction'],
    getLabel: () => 'Setup complete',
  },
];

export type VercelProgressSummary = {
  label: string;
  completed: boolean;
  completedCount: number;
  totalCount: number;
};

/**
 * Compute the skipped flag for a Vercel substep based on feature flags:
 *   - Action references Web → skipped when features.apps.web.enabled is false
 *   - Action references Admin / Superadmin → same per app
 *   - Action references Staging / InfisicalSyncStaging / InfisicalSyncPreview /
 *     storeStaging* → skipped when features.staging.enabled is false (preview is
 *     staging-tied since CI previews share the staging secret bundle).
 */
const isVercelActionSkipped = (config: ProjectConfig, action: VercelAction): boolean => {
  const stagingEnabled = config.features.staging.enabled;
  const a = action as string;
  // Detect app affinity. Order matters: check Superadmin before Admin to avoid
  // matching 'Superadmin' as 'Admin'.
  const isSuperadmin = /Superadmin/.test(a);
  const isAdmin = !isSuperadmin && /Admin/.test(a);
  const isWeb = /Web/.test(a);
  if (isSuperadmin && !config.features.apps.superadmin.enabled) return true;
  if (isAdmin && !config.features.apps.admin.enabled) return true;
  if (isWeb && !config.features.apps.web.enabled) return true;
  // Staging/preview gates (only relevant once the app is enabled)
  const isStaging = /Staging/.test(a) || /SyncPreview$/.test(a);
  if (isStaging && !stagingEnabled) return true;
  // GitHub-connect gate: link*GitHub + configure*Branches are skipped when
  // gitConnectFrontend is off (manual `vercel --prod` workflow).
  const isGitConnect = /GitHub$/.test(a) || /Branches$/.test(a);
  if (isGitConnect && !config.features.gitConnectFrontend.enabled) return true;
  return false;
};

export const getVercelProgressItems = (
  config: ProjectConfig,
): Array<{ label: string; completed: boolean; skipped: boolean }> => {
  const bootstrapSummary = getVercelProgressSummaries(config)[0];

  return [
    {
      label: bootstrapSummary.label,
      completed: bootstrapSummary.completed,
      skipped: false,
    },
    ...vercelWebSteps.map((step) => ({
      label: step.getLabel(config),
      completed: config.vercel.progress[step.action],
      skipped: isVercelActionSkipped(config, step.action),
    })),
    ...vercelAdminSteps.map((step) => ({
      label: step.getLabel(config),
      completed: config.vercel.progress[step.action],
      skipped: isVercelActionSkipped(config, step.action),
    })),
    ...vercelSuperadminSteps.map((step) => ({
      label: step.getLabel(config),
      completed: config.vercel.progress[step.action],
      skipped: isVercelActionSkipped(config, step.action),
    })),
    {
      label: 'Setup complete',
      completed: config.vercel.progress.deployProduction,
      skipped: false,
    },
  ];
};

export const getVercelProgressSummaries = (config: ProjectConfig): VercelProgressSummary[] => {
  return vercelProgressGroups.map((group) => {
    const completedCount = countCompletedActions(config.vercel.progress, group.actions);
    const totalCount = group.actions.length;
    return {
      label: group.getLabel(config, completedCount, totalCount),
      completed: completedCount === totalCount,
      completedCount,
      totalCount,
    };
  });
};
