import type { ProjectConfig } from '../utils/fetchProjectConfig';
import type { ProjectAction } from '../utils/progressTracking';

type ProjectProgressItem = {
  action: ProjectAction;
  labelFor: (config: ProjectConfig) => string;
};

const projectProgressItemDefinitions: readonly ProjectProgressItem[] = [
  {
    action: 'renameOrg',
    labelFor: (config) =>
      config.project.organization
        ? `Organization set: ${config.project.organization}`
        : 'Organization configured',
  },
  {
    action: 'updatePackages',
    labelFor: () => 'Package names updated',
  },
  {
    action: 'updateImports',
    labelFor: () => 'Import paths updated',
  },
  {
    action: 'updateReadme',
    labelFor: () => 'README updated',
  },
  {
    action: 'updateTsconfigs',
    labelFor: () => 'TypeScript configs updated',
  },
  {
    action: 'updateEnvFiles',
    labelFor: () => 'Environment files updated',
  },
  {
    action: 'cleanInstall',
    labelFor: () => 'Dependencies installed',
  },
  {
    action: 'setup',
    labelFor: () => 'Setup complete (Docker, Prisma)',
  },
];

export const projectProgressItems = (
  config: ProjectConfig,
): Array<{ label: string; completed: boolean }> => {
  return projectProgressItemDefinitions.map((item) => ({
    label: item.labelFor(config),
    completed: config.project.progress[item.action],
  }));
};
