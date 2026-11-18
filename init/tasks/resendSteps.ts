import type { ProjectConfig } from '../utils/fetchProjectConfig';
import type { ResendAction } from '../utils/progressTracking';

type ResendProgress = ProjectConfig['resend']['progress'];

type ResendProgressGroup = {
  actions: readonly ResendAction[];
  labelFor: (config: ProjectConfig, completedCount: number, totalCount: number) => string;
};

const countCompletedActions = (
  progress: ResendProgress,
  actions: readonly ResendAction[],
): number => {
  return actions.filter((action) => progress[action]).length;
};

const domainLabelOf = (fromAddress: string): string => {
  const domainName = fromAddress.split('@')[1];
  return domainName ?? fromAddress;
};

const resendProgressGroups: readonly ResendProgressGroup[] = [
  {
    actions: ['storeApiKey'],
    labelFor: () => 'API key stored in Infisical',
  },
  {
    actions: ['storeFromAddress'],
    labelFor: (config) =>
      config.resend.fromAddress
        ? `From address stored in Infisical: ${config.resend.fromAddress}`
        : 'From address stored in Infisical',
  },
  {
    actions: ['addDomain'],
    labelFor: (config) =>
      config.resend.fromAddress
        ? `Domain registered with Resend: ${domainLabelOf(config.resend.fromAddress)}`
        : 'Domain registered with Resend',
  },
  {
    actions: ['confirmDns'],
    labelFor: () => 'DNS records confirmed',
  },
];

export type ResendProgressSummary = {
  label: string;
  completed: boolean;
  completedCount: number;
  totalCount: number;
};

export const resendProgressSummaries = (config: ProjectConfig): ResendProgressSummary[] => {
  return resendProgressGroups.map((group) => {
    const completedCount = countCompletedActions(config.resend.progress, group.actions);
    const totalCount = group.actions.length;
    return {
      label: group.labelFor(config, completedCount, totalCount),
      completed: completedCount === totalCount,
      completedCount,
      totalCount,
    };
  });
};

export const resendProgressItems = (
  config: ProjectConfig,
): Array<{ label: string; completed: boolean }> => {
  return resendProgressSummaries(config).map((summary) => ({
    label: summary.label,
    completed: summary.completed,
  }));
};
