import type { ProjectConfig } from '../utils/getProjectConfig';
import type { PlanetScaleAction } from '../utils/progressTracking';

type PlanetScaleProgress = ProjectConfig['planetscale']['progress'];

type PlanetScaleProgressItem = {
  action: PlanetScaleAction;
  getLabel: (config: ProjectConfig) => string;
};

type PlanetScaleProgressGroup = {
  actions: readonly PlanetScaleAction[];
  getLabel: (config: ProjectConfig, completedCount: number, totalCount: number) => string;
};

const countCompletedActions = (progress: PlanetScaleProgress, actions: readonly PlanetScaleAction[]): number => {
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
    getLabel: (config) =>
      config.planetscale.organization
        ? `Organization selected: ${config.planetscale.organization}`
        : 'Organization selected',
  },
  {
    action: 'selectRegion',
    getLabel: (config) =>
      config.planetscale.region ? `Region selected: ${config.planetscale.region}` : 'Region selected',
  },
  {
    action: 'recordTokenId',
    getLabel: (config) =>
      config.planetscale.tokenId ? `Service token recorded: ${config.planetscale.tokenId}` : 'Service token recorded',
  },
  {
    action: 'storeOrganizationSecret',
    getLabel: () => 'PlanetScale organization stored in Infisical',
  },
  {
    action: 'storeRegionSecret',
    getLabel: () => 'PlanetScale region stored in Infisical',
  },
  {
    action: 'storeTokenIdSecret',
    getLabel: () => 'PlanetScale token ID stored in Infisical',
  },
  {
    action: 'storeTokenSecret',
    getLabel: () => 'PlanetScale token stored in Infisical',
  },
  {
    action: 'createDB',
    getLabel: (config) =>
      config.planetscale.database ? `Database created: ${config.planetscale.database}` : 'Database created',
  },
  {
    action: 'renameProductionBranch',
    getLabel: () => 'Rename main branch to prod',
  },
  {
    action: 'createStagingBranch',
    getLabel: () => 'Staging branch created',
  },
  {
    action: 'createProdRole',
    getLabel: () => 'Prod role created',
  },
  {
    action: 'createStagingRole',
    getLabel: () => 'Staging role created',
  },
  {
    action: 'storeProdConnectionString',
    getLabel: () => 'Prod connection string stored in Infisical',
  },
  {
    action: 'storeStagingConnectionString',
    getLabel: () => 'Staging connection string stored in Infisical',
  },
  {
    action: 'initProdMigrationTable',
    getLabel: () => 'Prod migration table initialized',
  },
  {
    action: 'initStagingMigrationTable',
    getLabel: () => 'Staging migration table initialized',
  },
  {
    action: 'configureDB',
    getLabel: () => 'Database configured (FK, migrations)',
  },
];

const planetscaleProgressGroups: readonly PlanetScaleProgressGroup[] = [
  {
    actions: ['selectOrg'],
    getLabel: (config) =>
      config.planetscale.organization
        ? `Organization selected: ${config.planetscale.organization}`
        : 'Organization selected',
  },
  {
    actions: ['selectRegion'],
    getLabel: (config) =>
      config.planetscale.region ? `Region selected: ${config.planetscale.region}` : 'Region selected',
  },
  {
    actions: ['recordTokenId'],
    getLabel: (config) =>
      config.planetscale.tokenId ? `Service token recorded: ${config.planetscale.tokenId}` : 'Service token recorded',
  },
  {
    actions: ['storeOrganizationSecret', 'storeRegionSecret', 'storeTokenIdSecret', 'storeTokenSecret'],
    getLabel: countLabel('PlanetScale secrets stored in Infisical'),
  },
  {
    actions: ['createDB'],
    getLabel: (config) =>
      config.planetscale.database ? `Database created: ${config.planetscale.database}` : 'Database created',
  },
  {
    actions: ['renameProductionBranch'],
    getLabel: () => 'Production branch renamed',
  },
  {
    actions: ['createStagingBranch'],
    getLabel: () => 'Staging branch created',
  },
  {
    actions: ['createProdRole', 'createStagingRole'],
    getLabel: countLabel('Roles created'),
  },
  {
    actions: ['storeProdConnectionString', 'storeStagingConnectionString'],
    getLabel: countLabel('Connection strings stored'),
  },
  {
    actions: ['initProdMigrationTable', 'initStagingMigrationTable'],
    getLabel: countLabel('Migration tables initialized'),
  },
  {
    actions: ['configureDB'],
    getLabel: () => 'Database configured',
  },
];

export type PlanetScaleProgressSummary = {
  label: string;
  completed: boolean;
  completedCount: number;
  totalCount: number;
};

export const getPlanetScaleProgressItems = (config: ProjectConfig): Array<{ label: string; completed: boolean }> => {
  return planetscaleProgressItems.map((item) => ({
    label: item.getLabel(config),
    completed: config.planetscale.progress[item.action],
  }));
};

export const getPlanetScaleProgressSummaries = (config: ProjectConfig): PlanetScaleProgressSummary[] => {
  return planetscaleProgressGroups.map((group) => {
    const completedCount = countCompletedActions(config.planetscale.progress, group.actions);
    const totalCount = group.actions.length;
    return {
      label: group.getLabel(config, completedCount, totalCount),
      completed: completedCount === totalCount,
      completedCount,
      totalCount,
    };
  });
};
