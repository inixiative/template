import type { ProjectConfig } from '../utils/getProjectConfig';
import type { RailwayBucketsAction } from '../utils/progressTracking';

type RailwayBucketsProgress = ProjectConfig['railwayBuckets']['progress'];

type RailwayBucketsProgressGroup = {
  actions: readonly RailwayBucketsAction[];
  getLabel: (config: ProjectConfig, completedCount: number, totalCount: number) => string;
  requiresStaging?: boolean;
};

const countCompletedActions = (
  progress: RailwayBucketsProgress,
  actions: readonly RailwayBucketsAction[],
): number => {
  return actions.filter((action) => progress[action]).length;
};

const railwayBucketsProgressGroups: readonly RailwayBucketsProgressGroup[] = [
  {
    actions: ['ensureProdSystemBucket', 'ensureProdUserBucket', 'storeProdCredentials'],
    getLabel: (config, completedCount, totalCount) =>
      config.railwayBuckets.prodSystemServiceId
        ? `Prod buckets ready (${completedCount}/${totalCount}): system=${config.railwayBuckets.prodSystemServiceId}`
        : `Prod buckets ready (${completedCount}/${totalCount})`,
  },
  {
    actions: ['ensureStagingSystemBucket', 'ensureStagingUserBucket', 'storeStagingCredentials'],
    requiresStaging: true,
    getLabel: (config, completedCount, totalCount) =>
      config.railwayBuckets.stagingSystemServiceId
        ? `Staging buckets ready (${completedCount}/${totalCount}): system=${config.railwayBuckets.stagingSystemServiceId}`
        : `Staging buckets ready (${completedCount}/${totalCount})`,
  },
];

export type RailwayBucketsProgressSummary = {
  label: string;
  completed: boolean;
  completedCount: number;
  totalCount: number;
  skipped: boolean;
};

export const getRailwayBucketsProgressSummaries = (config: ProjectConfig): RailwayBucketsProgressSummary[] => {
  const stagingEnabled = config.features.staging.enabled;
  return railwayBucketsProgressGroups.map((group) => {
    const skipped = !!group.requiresStaging && !stagingEnabled;
    const completedCount = countCompletedActions(config.railwayBuckets.progress, group.actions);
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

export const getRailwayBucketsProgressItems = (
  config: ProjectConfig,
): Array<{ label: string; completed: boolean; skipped: boolean }> => {
  return getRailwayBucketsProgressSummaries(config).map((summary) => ({
    label: summary.label,
    completed: summary.completed,
    skipped: summary.skipped,
  }));
};
