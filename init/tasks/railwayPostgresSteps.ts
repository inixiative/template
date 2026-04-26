import type { ProjectConfig } from '../utils/getProjectConfig';
import type { RailwayPostgresAction } from '../utils/progressTracking';

type RailwayPostgresProgress = ProjectConfig['railwayPostgres']['progress'];

type RailwayPostgresProgressGroup = {
  actions: readonly RailwayPostgresAction[];
  getLabel: (config: ProjectConfig, completedCount: number, totalCount: number) => string;
  // Marks the group as staging-only. We still emit it when staging is disabled,
  // but flagged as "skipped" so users see what WOULD run with staging on.
  requiresStaging?: boolean;
};

const countCompletedActions = (
  progress: RailwayPostgresProgress,
  actions: readonly RailwayPostgresAction[],
): number => {
  return actions.filter((action) => progress[action]).length;
};

const railwayPostgresProgressGroups: readonly RailwayPostgresProgressGroup[] = [
  {
    actions: ['ensureProdPostgresService', 'storeProdPostgresUrl'],
    getLabel: (config, completedCount, totalCount) =>
      config.railwayPostgres.prodServiceId
        ? `Prod Postgres provisioned (${completedCount}/${totalCount}): ${config.railwayPostgres.prodServiceId}`
        : `Prod Postgres provisioned (${completedCount}/${totalCount})`,
  },
  {
    actions: ['ensureStagingPostgresService', 'storeStagingPostgresUrl'],
    requiresStaging: true,
    getLabel: (config, completedCount, totalCount) =>
      config.railwayPostgres.stagingServiceId
        ? `Staging Postgres provisioned (${completedCount}/${totalCount}): ${config.railwayPostgres.stagingServiceId}`
        : `Staging Postgres provisioned (${completedCount}/${totalCount})`,
  },
];

export type RailwayPostgresProgressSummary = {
  label: string;
  completed: boolean;
  completedCount: number;
  totalCount: number;
  skipped: boolean;
};

export const getRailwayPostgresProgressSummaries = (config: ProjectConfig): RailwayPostgresProgressSummary[] => {
  const stagingEnabled = config.features.staging.enabled;
  return railwayPostgresProgressGroups.map((group) => {
    const skipped = !!group.requiresStaging && !stagingEnabled;
    const completedCount = countCompletedActions(config.railwayPostgres.progress, group.actions);
    const totalCount = group.actions.length;
    return {
      label: group.getLabel(config, completedCount, totalCount),
      completed: completedCount === totalCount,
      completedCount,
      totalCount,
      skipped,
    };
  });
};

export const getRailwayPostgresProgressItems = (
  config: ProjectConfig,
): Array<{ label: string; completed: boolean; skipped: boolean }> => {
  return getRailwayPostgresProgressSummaries(config).map((summary) => ({
    label: summary.label,
    completed: summary.completed,
    skipped: summary.skipped,
  }));
};
