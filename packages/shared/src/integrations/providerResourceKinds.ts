/**
 * @atlas
 * @kind registry
 * @partOf feature:integrations
 * @uses none
 */
import type { Provider } from '@template/db/generated/client/enums';
import { anthropicResourceKinds } from '@template/shared/integrations/providers/anthropic';
import { archiveResourceKinds } from '@template/shared/integrations/providers/archive';
import { confluenceResourceKinds } from '@template/shared/integrations/providers/confluence';
import { driveResourceKinds } from '@template/shared/integrations/providers/drive';
import { githubResourceKinds } from '@template/shared/integrations/providers/github';
import { jiraResourceKinds } from '@template/shared/integrations/providers/jira';
import { linearResourceKinds } from '@template/shared/integrations/providers/linear';
import { notionResourceKinds } from '@template/shared/integrations/providers/notion';
import { openaiResourceKinds } from '@template/shared/integrations/providers/openai';
import { slackResourceKinds } from '@template/shared/integrations/providers/slack';
import { teamsResourceKinds } from '@template/shared/integrations/providers/teams';
import {
  type ProviderResourceKinds,
  plainResourceKind,
  type ResourceKindDefinition,
} from '@template/shared/integrations/resourceKindDefinition';

export const providerResourceKinds: Record<Provider, ProviderResourceKinds> = {
  slack: slackResourceKinds,
  teams: teamsResourceKinds,
  linear: linearResourceKinds,
  notion: notionResourceKinds,
  jira: jiraResourceKinds,
  drive: driveResourceKinds,
  confluence: confluenceResourceKinds,
  anthropic: anthropicResourceKinds,
  openai: openaiResourceKinds,
  archive: archiveResourceKinds,
  github: githubResourceKinds,
};

/** The resource kind an integration's provider declares, or any kind with a plain identifier when it has none. */
export const resourceKindDefinition = (
  provider: Provider | null,
  kind: string,
): ResourceKindDefinition | undefined =>
  provider
    ? Object.hasOwn(providerResourceKinds[provider], kind)
      ? providerResourceKinds[provider][kind]
      : undefined
    : plainResourceKind;
