import type { ProjectConfig } from '../utils/getProjectConfig';
import type { RailwayPostgresAction } from '../utils/progressTracking';

type RailwayPostgresProgress = ProjectConfig['railwayPostgres']['progress'];

type RailwayPostgresProgressGroup = {
  actions: readonly RailwayPostgresAction[];
  getLabel: (config: ProjectConfig, completedCount: number, totalCount: number) => string;
  // Skip the group entirely when staging is disabled — used for the staging
  // Postgres group so the menu's progress count reflects "2/2" instead of "2/4".
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
};

export const getRailwayPostgresProgressSummaries = (config: ProjectConfig): RailwayPostgresProgressSummary[] => {
  const stagingEnabled = config.features.staging.enabled;
  return railwayPostgresProgressGroups
    .filter((group) => stagingEnabled || !group.requiresStaging)
    .map((group) => {
      const completedCount = countCompletedActions(config.railwayPostgres.progress, group.actions);
      const totalCount = group.actions.length;
      return {
        label: group.getLabel(config, completedCount, totalCount),
        completed: completedCount === totalCount,
        completedCount,
        totalCount,
      };
    });
};

export const getRailwayPostgresProgressItems = (
  config: ProjectConfig,
): Array<{ label: string; completed: boolean }> => {
  return getRailwayPostgresProgressSummaries(config).map((summary) => ({
    label: summary.label,
    completed: summary.completed,
  }));
};
