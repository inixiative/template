import type { ProjectConfig } from '../utils/fetchProjectConfig';
import type { BouncerAction } from '../utils/progressTracking';

type BouncerProgress = ProjectConfig['bouncer']['progress'];

type BouncerProgressGroup = {
  actions: readonly BouncerAction[];
  labelFor: (config: ProjectConfig, completedCount: number, totalCount: number) => string;
};

const countCompletedActions = (
  progress: BouncerProgress,
  actions: readonly BouncerAction[],
): number => {
  return actions.filter((action) => progress[action]).length;
};

const bouncerProgressGroups: readonly BouncerProgressGroup[] = [
  {
    actions: ['storeApiKey'],
    labelFor: () => 'API key stored in Infisical',
  },
];

export type BouncerProgressSummary = {
  label: string;
  completed: boolean;
  completedCount: number;
  totalCount: number;
};

export const bouncerProgressSummaries = (config: ProjectConfig): BouncerProgressSummary[] => {
  return bouncerProgressGroups.map((group) => {
    const completedCount = countCompletedActions(config.bouncer.progress, group.actions);
    const totalCount = group.actions.length;
    return {
      label: group.labelFor(config, completedCount, totalCount),
      completed: completedCount === totalCount,
      completedCount,
      totalCount,
    };
  });
};

export const bouncerProgressItems = (
  config: ProjectConfig,
): Array<{ label: string; completed: boolean }> => {
  return bouncerProgressSummaries(config).map((summary) => ({
    label: summary.label,
    completed: summary.completed,
  }));
};
