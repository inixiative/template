import type { ProjectConfig } from '../utils/fetchProjectConfig';
import type { RailwayAction } from '../utils/progressTracking';

type RailwayProgress = NonNullable<ProjectConfig['railway']>['progress'];

type RailwayProgressGroup = {
  actions: readonly RailwayAction[];
  labelFor: (config: ProjectConfig, completedCount: number, totalCount: number) => string;
};

const countCompletedActions = (
  progress: RailwayProgress,
  actions: readonly RailwayAction[],
): number => {
  return actions.filter((action) => progress[action]).length;
};

const railwayProgressGroups: readonly RailwayProgressGroup[] = [
  {
    actions: ['selectWorkspace'],
    labelFor: (config) =>
      config.railway?.workspaceId
        ? `Workspace selected: ${config.railway.workspaceId}`
        : 'Workspace selected',
  },
  {
    actions: ['storeRailwayToken'],
    labelFor: () => 'Railway token stored in Infisical',
  },
  {
    actions: ['createProject'],
    labelFor: (config) =>
      config.railway?.projectId
        ? `Project created: ${config.railway.projectId}`
        : 'Project created',
  },
  {
    actions: [
      'ensureProdEnvironment',
      'storeProdEnvironmentIdSecret',
      'deleteLegacyProductionEnvironment',
    ],
    labelFor: (config, completedCount, totalCount) =>
      config.railway?.prodEnvironmentId
        ? `Production environment ready (${completedCount}/${totalCount}): ${config.railway.prodEnvironmentId}`
        : `Production environment ready (${completedCount}/${totalCount})`,
  },
  {
    actions: ['ensureStagingEnvironment', 'storeStagingEnvironmentIdSecret'],
    labelFor: (config, completedCount, totalCount) =>
      config.railway?.stagingEnvironmentId
        ? `Staging environment ready (${completedCount}/${totalCount}): ${config.railway.stagingEnvironmentId}`
        : `Staging environment ready (${completedCount}/${totalCount})`,
  },
  {
    actions: [
      'ensureProdRedisService',
      'captureProdRedisVolume',
      'renameProdRedisService',
      'renameProdRedisVolume',
      'storeProdRedisUrl',
    ],
    labelFor: (config, completedCount, totalCount) =>
      config.railway?.prodRedisServiceId
        ? `Prod Redis ready (${completedCount}/${totalCount}): ${config.railway.prodRedisServiceId}`
        : `Prod Redis ready (${completedCount}/${totalCount})`,
  },
  {
    actions: [
      'ensureStagingRedisService',
      'captureStagingRedisVolume',
      'renameStagingRedisService',
      'renameStagingRedisVolume',
      'storeStagingRedisUrl',
    ],
    labelFor: (config, completedCount, totalCount) =>
      config.railway?.stagingRedisServiceId
        ? `Staging Redis ready (${completedCount}/${totalCount}): ${config.railway.stagingRedisServiceId}`
        : `Staging Redis ready (${completedCount}/${totalCount})`,
  },
  {
    actions: ['createInfisicalConnection'],
    labelFor: () => 'Infisical Railway connection created',
  },
  {
    actions: ['promptedForGithub'],
    labelFor: () => 'GitHub setup confirmed',
  },
  {
    actions: [
      'ensureProdApiService',
      'storeProdApiServiceIdSecret',
      'createInfisicalSyncProd',
      'configureProdApiService',
      'connectProdApiGithub',
      'ensureProdApiDeployment',
      'storeProdApiUrl',
    ],
    labelFor: (config, completedCount, totalCount) =>
      config.railway?.prodApiServiceId
        ? `Prod API ready (${completedCount}/${totalCount}): ${config.railway.prodApiServiceId}`
        : `Prod API ready (${completedCount}/${totalCount})`,
  },
  {
    actions: [
      'ensureStagingApiService',
      'storeStagingApiServiceIdSecret',
      'createInfisicalSyncStagingApi',
      'configureStagingApiService',
      'connectStagingApiGithub',
      'ensureStagingApiDeployment',
      'storeStagingApiUrl',
    ],
    labelFor: (config, completedCount, totalCount) =>
      config.railway?.stagingApiServiceId
        ? `Staging API ready (${completedCount}/${totalCount}): ${config.railway.stagingApiServiceId}`
        : `Staging API ready (${completedCount}/${totalCount})`,
  },
  {
    actions: [
      'ensureProdWorkerService',
      'storeProdWorkerServiceIdSecret',
      'createInfisicalSyncProdWorker',
      'configureProdWorkerService',
      'connectProdWorkerGithub',
      'ensureProdWorkerDeployment',
    ],
    labelFor: (config, completedCount, totalCount) =>
      config.railway?.prodWorkerServiceId
        ? `Prod Worker ready (${completedCount}/${totalCount}): ${config.railway.prodWorkerServiceId}`
        : `Prod Worker ready (${completedCount}/${totalCount})`,
  },
  {
    actions: [
      'ensureStagingWorkerService',
      'storeStagingWorkerServiceIdSecret',
      'createInfisicalSyncStagingWorker',
      'configureStagingWorkerService',
      'connectStagingWorkerGithub',
      'ensureStagingWorkerDeployment',
    ],
    labelFor: (config, completedCount, totalCount) =>
      config.railway?.stagingWorkerServiceId
        ? `Staging Worker ready (${completedCount}/${totalCount}): ${config.railway.stagingWorkerServiceId}`
        : `Staging Worker ready (${completedCount}/${totalCount})`,
  },
];

export type RailwayProgressSummary = {
  label: string;
  completed: boolean;
  completedCount: number;
  totalCount: number;
};

export const railwayProgressSummaries = (config: ProjectConfig): RailwayProgressSummary[] => {
  if (!config.railway) {
    return [];
  }

  return railwayProgressGroups.map((group) => {
    const completedCount = countCompletedActions(config.railway.progress, group.actions);
    const totalCount = group.actions.length;
    return {
      label: group.labelFor(config, completedCount, totalCount),
      completed: completedCount === totalCount,
      completedCount,
      totalCount,
    };
  });
};

export const railwayProgressItems = (
  config: ProjectConfig,
): Array<{ label: string; completed: boolean }> => {
  return railwayProgressSummaries(config).map((summary) => ({
    label: summary.label,
    completed: summary.completed,
  }));
};
