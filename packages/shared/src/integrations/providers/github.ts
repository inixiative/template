/**
 * @atlas
 * @kind registry
 * @partOf feature:integrations
 * @uses none
 */
import type { ProviderResourceKinds } from '@template/shared/integrations/resourceKindDefinition';
import { z } from 'zod';

export const githubResourceKinds: ProviderResourceKinds = {
  repository: { externalId: z.string().regex(/^[1-9][0-9]{0,18}$/) },
};
