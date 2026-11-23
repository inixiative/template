/**
 * @atlas
 * @kind registry
 * @partOf feature:integrations
 * @uses none
 */
import type { Provider } from '@template/db/generated/client/enums';
import { z } from 'zod';

export type ResourceKindDefinition = { externalId: z.ZodType<string> };

const providerIdentifierSchema = z
  .string()
  .min(1)
  .max(250)
  .regex(/^[a-zA-Z0-9_:@.-]+$/)
  .refine((id) => id !== '.' && id !== '..');

const githubRepositoryIdSchema = z.string().regex(/^[1-9][0-9]{0,18}$/);

const kinds = (...names: string[]): Record<string, ResourceKindDefinition> =>
  Object.fromEntries(names.map((name) => [name, { externalId: providerIdentifierSchema }]));

export const providerResourceKinds: Record<Provider, Record<string, ResourceKindDefinition>> = {
  slack: kinds('channel'),
  teams: kinds('channel'),
  linear: kinds('issue', 'team'),
  notion: kinds('page'),
  jira: kinds('issue'),
  drive: kinds('file'),
  confluence: kinds('page'),
  anthropic: kinds('model'),
  openai: kinds('model'),
  archive: kinds('archiveLibrary'),
  github: { repository: { externalId: githubRepositoryIdSchema } },
};

/** The resource kind an integration's provider declares, or any kind with a plain identifier when it has none. */
export const resourceKindDefinition = (
  provider: Provider | null,
  kind: string,
): ResourceKindDefinition | undefined =>
  provider ? providerResourceKinds[provider][kind] : { externalId: providerIdentifierSchema };
