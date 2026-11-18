import type { ProjectConfig } from '../utils/fetchProjectConfig';
import type { RailwayPostgresAction } from '../utils/progressTracking';

type RailwayPostgresProgress = ProjectConfig['railwayPostgres']['progress'];

type RailwayPostgresProgressGroup = {
  actions: readonly RailwayPostgresAction[];
  labelFor: (config: ProjectConfig, completedCount: number, totalCount: number) => string;
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
    actions: [
      'ensureProdPostgresService',
      'captureProdPostgresVolume',
      'renameProdPostgresService',
      'renameProdPostgresVolume',
      'storeProdPostgresUrl',
    ],
    labelFor: (config, completedCount, totalCount) =>
      config.railwayPostgres.prodServiceId
        ? `Prod Postgres ready (${completedCount}/${totalCount}): ${config.railwayPostgres.prodServiceId}`
        : `Prod Postgres ready (${completedCount}/${totalCount})`,
  },
  {
    actions: [
      'ensureStagingPostgresService',
      'captureStagingPostgresVolume',
      'renameStagingPostgresService',
      'renameStagingPostgresVolume',
      'storeStagingPostgresUrl',
    ],
    requiresStaging: true,
    labelFor: (config, completedCount, totalCount) =>
      config.railwayPostgres.stagingServiceId
        ? `Staging Postgres ready (${completedCount}/${totalCount}): ${config.railwayPostgres.stagingServiceId}`
        : `Staging Postgres ready (${completedCount}/${totalCount})`,
  },
];

export type RailwayPostgresProgressSummary = {
  label: string;
  completed: boolean;
  completedCount: number;
  totalCount: number;
  skipped: boolean;
};

export const railwayPostgresProgressSummaries = (
  config: ProjectConfig,
): RailwayPostgresProgressSummary[] => {
  const stagingEnabled = config.features.staging.enabled;
  return railwayPostgresProgressGroups.map((group) => {
    const skipped = !!group.requiresStaging && !stagingEnabled;
    const completedCount = countCompletedActions(config.railwayPostgres.progress, group.actions);
    const totalCount = group.actions.length;
    return {
      label: group.labelFor(config, completedCount, totalCount),
      completed: completedCount === totalCount,
      completedCount,
      totalCount,
      skipped,
    };
  });
};

export const railwayPostgresProgressItems = (
  config: ProjectConfig,
): Array<{ label: string; completed: boolean; skipped: boolean }> => {
  return railwayPostgresProgressSummaries(config).map((summary) => ({
    label: summary.label,
    completed: summary.completed,
    skipped: summary.skipped,
  }));
};
