import type { ProjectConfig } from '../utils/getProjectConfig';
import type { ResendAction } from '../utils/progressTracking';

type ResendProgress = ProjectConfig['resend']['progress'];

type ResendProgressGroup = {
  actions: readonly ResendAction[];
  getLabel: (config: ProjectConfig, completedCount: number, totalCount: number) => string;
};

const countCompletedActions = (progress: ResendProgress, actions: readonly ResendAction[]): number => {
  return actions.filter((action) => progress[action]).length;
};

const getDomainLabel = (fromAddress: string): string => {
  const domainName = fromAddress.split('@')[1];
  return domainName ?? fromAddress;
};

const resendProgressGroups: readonly ResendProgressGroup[] = [
  {
    actions: ['storeApiKey'],
    getLabel: () => 'API key stored in Infisical',
  },
  {
    actions: ['storeFromAddress'],
    getLabel: (config) =>
      config.resend.fromAddress
        ? `From address stored in Infisical: ${config.resend.fromAddress}`
        : 'From address stored in Infisical',
  },
  {
    actions: ['addDomain'],
    getLabel: (config) =>
      config.resend.fromAddress
        ? `Domain registered with Resend: ${getDomainLabel(config.resend.fromAddress)}`
        : 'Domain registered with Resend',
  },
  {
    actions: ['confirmDns'],
    getLabel: () => 'DNS records confirmed',
  },
];

export type ResendProgressSummary = {
  label: string;
  completed: boolean;
  completedCount: number;
  totalCount: number;
};

export const getResendProgressSummaries = (config: ProjectConfig): ResendProgressSummary[] => {
  return resendProgressGroups.map((group) => {
    const completedCount = countCompletedActions(config.resend.progress, group.actions);
    const totalCount = group.actions.length;
    return {
      label: group.getLabel(config, completedCount, totalCount),
      completed: completedCount === totalCount,
      completedCount,
      totalCount,
    };
  });
};

export const getResendProgressItems = (config: ProjectConfig): Array<{ label: string; completed: boolean }> => {
  return getResendProgressSummaries(config).map((summary) => ({
    label: summary.label,
    completed: summary.completed,
  }));
};
