import type { ProjectConfig } from '../utils/fetchProjectConfig';
import type { PlanetScaleAction } from '../utils/progressTracking';

type PlanetScaleProgress = ProjectConfig['planetscale']['progress'];

type PlanetScaleProgressItem = {
  action: PlanetScaleAction;
  labelFor: (config: ProjectConfig) => string;
};

type PlanetScaleProgressGroup = {
  actions: readonly PlanetScaleAction[];
  labelFor: (config: ProjectConfig, completedCount: number, totalCount: number) => string;
};

const countCompletedActions = (
  progress: PlanetScaleProgress,
  actions: readonly PlanetScaleAction[],
): number => {
  return actions.filter((action) => progress[action]).length;
};

const countLabel =
  (label: string) =>
  (_config: ProjectConfig, completedCount: number, totalCount: number): string => {
    return `${label} (${completedCount}/${totalCount})`;
  };

const planetscaleProgressItems: readonly PlanetScaleProgressItem[] = [
  {
    action: 'selectOrg',
    labelFor: (config) =>
      config.planetscale.organization
        ? `Organization selected: ${config.planetscale.organization}`
        : 'Organization selected',
  },
  {
    action: 'selectRegion',
    labelFor: (config) =>
      config.planetscale.region
        ? `Region selected: ${config.planetscale.region}`
        : 'Region selected',
  },
  {
    action: 'recordTokenId',
    labelFor: (config) =>
      config.planetscale.tokenId
        ? `Service token recorded: ${config.planetscale.tokenId}`
        : 'Service token recorded',
  },
  {
    action: 'storeOrganizationSecret',
    labelFor: () => 'PlanetScale organization stored in Infisical',
  },
  {
    action: 'storeRegionSecret',
    labelFor: () => 'PlanetScale region stored in Infisical',
  },
  {
    action: 'storeTokenIdSecret',
    labelFor: () => 'PlanetScale token ID stored in Infisical',
  },
  {
    action: 'storeTokenSecret',
    labelFor: () => 'PlanetScale token stored in Infisical',
  },
  {
    action: 'createDB',
    labelFor: (config) =>
      config.planetscale.database
        ? `Database created: ${config.planetscale.database}`
        : 'Database created',
  },
  {
    action: 'renameProductionBranch',
    labelFor: () => 'Rename main branch to prod',
  },
  {
    action: 'createStagingBranch',
    labelFor: () => 'Staging branch created',
  },
  {
    action: 'createProdRole',
    labelFor: () => 'Prod role created',
  },
  {
    action: 'createStagingRole',
    labelFor: () => 'Staging role created',
  },
  {
    action: 'storeProdConnectionString',
    labelFor: () => 'Prod connection string stored in Infisical',
  },
  {
    action: 'storeStagingConnectionString',
    labelFor: () => 'Staging connection string stored in Infisical',
  },
  {
    action: 'initProdMigrationTable',
    labelFor: () => 'Prod migration table initialized',
  },
  {
    action: 'initStagingMigrationTable',
    labelFor: () => 'Staging migration table initialized',
  },
  {
    action: 'configureDB',
    labelFor: () => 'Database configured (FK, migrations)',
  },
];

const planetscaleProgressGroups: readonly PlanetScaleProgressGroup[] = [
  {
    actions: ['selectOrg'],
    labelFor: (config) =>
      config.planetscale.organization
        ? `Organization selected: ${config.planetscale.organization}`
        : 'Organization selected',
  },
  {
    actions: ['selectRegion'],
    labelFor: (config) =>
      config.planetscale.region
        ? `Region selected: ${config.planetscale.region}`
        : 'Region selected',
  },
  {
    actions: ['recordTokenId'],
    labelFor: (config) =>
      config.planetscale.tokenId
        ? `Service token recorded: ${config.planetscale.tokenId}`
        : 'Service token recorded',
  },
  {
    actions: [
      'storeOrganizationSecret',
      'storeRegionSecret',
      'storeTokenIdSecret',
      'storeTokenSecret',
    ],
    labelFor: countLabel('PlanetScale secrets stored in Infisical'),
  },
  {
    actions: ['createDB'],
    labelFor: (config) =>
      config.planetscale.database
        ? `Database created: ${config.planetscale.database}`
        : 'Database created',
  },
  {
    actions: ['renameProductionBranch'],
    labelFor: () => 'Production branch renamed',
  },
  {
    actions: ['createStagingBranch'],
    labelFor: () => 'Staging branch created',
  },
  {
    actions: ['createProdRole', 'createStagingRole'],
    labelFor: countLabel('Roles created'),
  },
  {
    actions: ['storeProdConnectionString', 'storeStagingConnectionString'],
    labelFor: countLabel('Connection strings stored'),
  },
  {
    actions: ['initProdMigrationTable', 'initStagingMigrationTable'],
    labelFor: countLabel('Migration tables initialized'),
  },
  {
    actions: ['configureDB'],
    labelFor: () => 'Database configured',
  },
];

export type PlanetScaleProgressSummary = {
  label: string;
  completed: boolean;
  completedCount: number;
  totalCount: number;
};

export const planetScaleProgressItems = (
  config: ProjectConfig,
): Array<{ label: string; completed: boolean }> => {
  return planetscaleProgressItems.map((item) => ({
    label: item.labelFor(config),
    completed: config.planetscale.progress[item.action],
  }));
};

export const planetScaleProgressSummaries = (
  config: ProjectConfig,
): PlanetScaleProgressSummary[] => {
  return planetscaleProgressGroups.map((group) => {
    const completedCount = countCompletedActions(config.planetscale.progress, group.actions);
    const totalCount = group.actions.length;
    return {
      label: group.labelFor(config, completedCount, totalCount),
      completed: completedCount === totalCount,
      completedCount,
      totalCount,
    };
  });
};
