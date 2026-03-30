import type { ProjectConfig } from '../utils/getProjectConfig';
import type { ProjectAction } from '../utils/progressTracking';

type ProjectProgressItem = {
  action: ProjectAction;
  getLabel: (config: ProjectConfig) => string;
};

const projectProgressItems: readonly ProjectProgressItem[] = [
  {
    action: 'renameOrg',
    getLabel: (config) =>
      config.project.organization ? `Organization set: ${config.project.organization}` : 'Organization configured',
  },
  {
    action: 'updatePackages',
    getLabel: () => 'Package names updated',
  },
  {
    action: 'updateImports',
    getLabel: () => 'Import paths updated',
  },
  {
    action: 'updateReadme',
    getLabel: () => 'README updated',
  },
  {
    action: 'updateTsconfigs',
    getLabel: () => 'TypeScript configs updated',
  },
  {
    action: 'updateEnvFiles',
    getLabel: () => 'Environment files updated',
  },
  {
    action: 'cleanInstall',
    getLabel: () => 'Dependencies installed',
  },
  {
    action: 'setup',
    getLabel: () => 'Setup complete (Docker, Prisma)',
  },
];

export const getProjectProgressItems = (config: ProjectConfig): Array<{ label: string; completed: boolean }> => {
  return projectProgressItems.map((item) => ({
    label: item.getLabel(config),
    completed: config.project.progress[item.action],
  }));
};
