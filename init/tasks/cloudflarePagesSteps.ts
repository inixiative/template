import type { ProjectConfig } from '../utils/fetchProjectConfig';
import type { CloudflarePagesAction } from '../utils/progressTracking';

type Progress = ProjectConfig['cloudflarePages']['progress'];

type Group = {
  actions: readonly CloudflarePagesAction[];
  labelFor: (config: ProjectConfig, completedCount: number, totalCount: number) => string;
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
    labelFor: (cfg) =>
      cfg.cloudflarePages.accountName
        ? `Account selected: ${cfg.cloudflarePages.accountName}`
        : 'Account selected',
  },
  {
    actions: ['storeApiToken'],
    labelFor: () => 'API token stored in Infisical',
  },
  {
    actions: ['createWebProject', 'linkWebGitHub'],
    appKey: 'web',
    labelFor: (cfg, c, t) =>
      cfg.cloudflarePages.webProjectName
        ? `Web project ready (${c}/${t}): ${cfg.cloudflarePages.webProjectName}`
        : `Web project ready (${c}/${t})`,
  },
  {
    actions: ['syncWebEnvProd'],
    appKey: 'web',
    labelFor: (_, c, t) => `Web prod env synced (${c}/${t})`,
  },
  {
    actions: ['syncWebEnvStaging'],
    appKey: 'web',
    requiresStaging: true,
    labelFor: (_, c, t) => `Web staging env synced (${c}/${t})`,
  },
  {
    actions: ['createAdminProject', 'linkAdminGitHub'],
    appKey: 'admin',
    labelFor: (cfg, c, t) =>
      cfg.cloudflarePages.adminProjectName
        ? `Admin project ready (${c}/${t}): ${cfg.cloudflarePages.adminProjectName}`
        : `Admin project ready (${c}/${t})`,
  },
  {
    actions: ['syncAdminEnvProd'],
    appKey: 'admin',
    labelFor: (_, c, t) => `Admin prod env synced (${c}/${t})`,
  },
  {
    actions: ['syncAdminEnvStaging'],
    appKey: 'admin',
    requiresStaging: true,
    labelFor: (_, c, t) => `Admin staging env synced (${c}/${t})`,
  },
  {
    actions: ['createSuperadminProject', 'linkSuperadminGitHub'],
    appKey: 'superadmin',
    labelFor: (cfg, c, t) =>
      cfg.cloudflarePages.superadminProjectName
        ? `Superadmin project ready (${c}/${t}): ${cfg.cloudflarePages.superadminProjectName}`
        : `Superadmin project ready (${c}/${t})`,
  },
  {
    actions: ['syncSuperadminEnvProd'],
    appKey: 'superadmin',
    labelFor: (_, c, t) => `Superadmin prod env synced (${c}/${t})`,
  },
  {
    actions: ['syncSuperadminEnvStaging'],
    appKey: 'superadmin',
    requiresStaging: true,
    labelFor: (_, c, t) => `Superadmin staging env synced (${c}/${t})`,
  },
];

export type CloudflarePagesProgressSummary = {
  label: string;
  completed: boolean;
  completedCount: number;
  totalCount: number;
  skipped: boolean;
};

export const cloudflarePagesProgressSummaries = (
  config: ProjectConfig,
): CloudflarePagesProgressSummary[] => {
  const stagingEnabled = config.features.staging.enabled;
  return groups.map((g) => {
    const appDisabled = g.appKey ? !config.features.apps[g.appKey].enabled : false;
    const stagingMissing = !!g.requiresStaging && !stagingEnabled;
    const skipped = appDisabled || stagingMissing;
    const completedCount = count(config.cloudflarePages.progress, g.actions);
    const totalCount = g.actions.length;
    return {
      label: g.labelFor(config, completedCount, totalCount),
      completed: completedCount === totalCount,
      completedCount,
      totalCount,
      skipped,
    };
  });
};

export const cloudflarePagesProgressItems = (
  config: ProjectConfig,
): Array<{ label: string; completed: boolean; skipped: boolean }> => {
  return cloudflarePagesProgressSummaries(config).map((s) => ({
    label: s.label,
    completed: s.completed,
    skipped: s.skipped,
  }));
};

/**
 * Actions belonging to non-skipped groups (live apps + staging-when-enabled).
 * Use this to derive a filtered progress map for completion %, so disabled
 * web/admin/staging steps don't drag the section to "incomplete".
 */
export const cloudflarePagesLiveActions = (
  config: ProjectConfig,
): readonly CloudflarePagesAction[] => {
  const stagingEnabled = config.features.staging.enabled;
  const live: CloudflarePagesAction[] = [];
  for (const g of groups) {
    const appDisabled = g.appKey ? !config.features.apps[g.appKey].enabled : false;
    const stagingMissing = !!g.requiresStaging && !stagingEnabled;
    if (appDisabled || stagingMissing) continue;
    for (const a of g.actions) live.push(a);
  }
  return live;
};
