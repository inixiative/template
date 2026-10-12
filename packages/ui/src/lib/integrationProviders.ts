/**
 * @atlas
 * @kind config
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { MeCreateIntegrationData } from '@template/sdk';

export type IntegrationProvider = NonNullable<MeCreateIntegrationData['body']['provider']>;

export type IntegrationProviderEntry = {
  label: string;
  icon: string;
  directConnect: boolean;
};

export const integrationProviders: Record<IntegrationProvider, IntegrationProviderEntry> = {
  slack: { label: 'Slack', icon: 'simple-icons:slack', directConnect: true },
  teams: { label: 'Microsoft Teams', icon: 'simple-icons:microsoftteams', directConnect: true },
  linear: { label: 'Linear', icon: 'simple-icons:linear', directConnect: true },
  notion: { label: 'Notion', icon: 'simple-icons:notion', directConnect: true },
  jira: { label: 'Jira', icon: 'simple-icons:jira', directConnect: true },
  drive: { label: 'Google Drive', icon: 'simple-icons:googledrive', directConnect: true },
  confluence: { label: 'Confluence', icon: 'simple-icons:confluence', directConnect: true },
  anthropic: { label: 'Anthropic', icon: 'simple-icons:anthropic', directConnect: true },
  openai: { label: 'OpenAI', icon: 'simple-icons:openai', directConnect: true },
  archive: { label: 'Archive', icon: 'lucide:archive', directConnect: true },
  github: { label: 'GitHub', icon: 'simple-icons:github', directConnect: true },
};

export const integrationProviderValues = Object.keys(integrationProviders) as IntegrationProvider[];

export const customIntegration = { label: 'Custom', icon: 'lucide:puzzle' };
