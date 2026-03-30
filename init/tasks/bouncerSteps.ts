import type { ProjectConfig } from '../utils/getProjectConfig';
import type { BouncerAction } from '../utils/progressTracking';

type BouncerProgress = ProjectConfig['bouncer']['progress'];

type BouncerProgressGroup = {
  actions: readonly BouncerAction[];
  getLabel: (config: ProjectConfig, completedCount: number, totalCount: number) => string;
};

const countCompletedActions = (progress: BouncerProgress, actions: readonly BouncerAction[]): number => {
  return actions.filter((action) => progress[action]).length;
};

const bouncerProgressGroups: readonly BouncerProgressGroup[] = [
  {
    actions: ['storeApiKey'],
    getLabel: () => 'API key stored in Infisical',
  },
];

export type BouncerProgressSummary = {
  label: string;
  completed: boolean;
  completedCount: number;
  totalCount: number;
};

export const getBouncerProgressSummaries = (config: ProjectConfig): BouncerProgressSummary[] => {
  return bouncerProgressGroups.map((group) => {
    const completedCount = countCompletedActions(config.bouncer.progress, group.actions);
    const totalCount = group.actions.length;
    return {
      label: group.getLabel(config, completedCount, totalCount),
      completed: completedCount === totalCount,
      completedCount,
      totalCount,
    };
  });
};

export const getBouncerProgressItems = (config: ProjectConfig): Array<{ label: string; completed: boolean }> => {
  return getBouncerProgressSummaries(config).map((summary) => ({
    label: summary.label,
    completed: summary.completed,
  }));
};
