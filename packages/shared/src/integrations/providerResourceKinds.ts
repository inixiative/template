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
import type { ResourceKind } from '@template/shared/integrations/resourceKind';

export const providerResourceKinds: Record<Provider, Record<string, ResourceKind>> = {
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
