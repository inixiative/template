import type { ProjectConfig } from '../utils/getProjectConfig';
import type { CloudflarePagesAction } from '../utils/progressTracking';

type Progress = ProjectConfig['cloudflarePages']['progress'];

type Group = {
  actions: readonly CloudflarePagesAction[];
  getLabel: (config: ProjectConfig, completedCount: number, totalCount: number) => string;
  /** Marks a per-app group; entire group is skipped when features.apps.<app>.enabled is false. */
  appKey?: 'web' | 'admin' | 'superadmin';
  /** Marks a step as staging-only; skipped when features.staging.enabled is false. */
  requiresStaging?: boolean;
};

const count = (progress: Progress, actions: readonly CloudflarePagesAction[]): number =>
  actions.filter((a) => progress[a]).length;

const groups: readonly Group[] = [
  {
    actions: ['selectAccount'],
    getLabel: (cfg) =>
      cfg.cloudflarePages.accountName ? `Account selected: ${cfg.cloudflarePages.accountName}` : 'Account selected',
  },
  {
    actions: ['storeApiToken'],
    getLabel: () => 'API token stored in Infisical',
  },
  {
    actions: ['createWebProject', 'linkWebGitHub'],
    appKey: 'web',
    getLabel: (cfg, c, t) =>
      cfg.cloudflarePages.webProjectName
        ? `Web project ready (${c}/${t}): ${cfg.cloudflarePages.webProjectName}`
        : `Web project ready (${c}/${t})`,
  },
  {
    actions: ['syncWebEnvProd'],
    appKey: 'web',
    getLabel: (_, c, t) => `Web prod env synced (${c}/${t})`,
  },
  {
    actions: ['syncWebEnvStaging'],
    appKey: 'web',
    requiresStaging: true,
    getLabel: (_, c, t) => `Web staging env synced (${c}/${t})`,
  },
  {
    actions: ['createAdminProject', 'linkAdminGitHub'],
    appKey: 'admin',
    getLabel: (cfg, c, t) =>
      cfg.cloudflarePages.adminProjectName
        ? `Admin project ready (${c}/${t}): ${cfg.cloudflarePages.adminProjectName}`
        : `Admin project ready (${c}/${t})`,
  },
  {
    actions: ['syncAdminEnvProd'],
    appKey: 'admin',
    getLabel: (_, c, t) => `Admin prod env synced (${c}/${t})`,
  },
  {
    actions: ['syncAdminEnvStaging'],
    appKey: 'admin',
    requiresStaging: true,
    getLabel: (_, c, t) => `Admin staging env synced (${c}/${t})`,
  },
  {
    actions: ['createSuperadminProject', 'linkSuperadminGitHub'],
    appKey: 'superadmin',
    getLabel: (cfg, c, t) =>
      cfg.cloudflarePages.superadminProjectName
        ? `Superadmin project ready (${c}/${t}): ${cfg.cloudflarePages.superadminProjectName}`
        : `Superadmin project ready (${c}/${t})`,
  },
  {
    actions: ['syncSuperadminEnvProd'],
    appKey: 'superadmin',
    getLabel: (_, c, t) => `Superadmin prod env synced (${c}/${t})`,
  },
  {
    actions: ['syncSuperadminEnvStaging'],
    appKey: 'superadmin',
    requiresStaging: true,
    getLabel: (_, c, t) => `Superadmin staging env synced (${c}/${t})`,
  },
];

export type CloudflarePagesProgressSummary = {
  label: string;
  completed: boolean;
  completedCount: number;
  totalCount: number;
  skipped: boolean;
};

export const getCloudflarePagesProgressSummaries = (config: ProjectConfig): CloudflarePagesProgressSummary[] => {
  const stagingEnabled = config.features.staging.enabled;
  return groups.map((g) => {
    const appDisabled = g.appKey ? !config.features.apps[g.appKey].enabled : false;
    const stagingMissing = !!g.requiresStaging && !stagingEnabled;
    const skipped = appDisabled || stagingMissing;
    const completedCount = count(config.cloudflarePages.progress, g.actions);
    const totalCount = g.actions.length;
    return {
      label: g.getLabel(config, completedCount, totalCount),
      completed: completedCount === totalCount,
      completedCount,
      totalCount,
      skipped,
    };
  });
};

export const getCloudflarePagesProgressItems = (
  config: ProjectConfig,
): Array<{ label: string; completed: boolean; skipped: boolean }> => {
  return getCloudflarePagesProgressSummaries(config).map((s) => ({
    label: s.label,
    completed: s.completed,
    skipped: s.skipped,
  }));
};
