/**
 * @atlas
 * @kind registry
 * @partOf feature:integrations
 * @uses none
 */
import type { ResourceKind } from '@template/shared/integrations/resourceKind';
import { z } from 'zod';

export const githubResourceKinds: Record<string, ResourceKind> = {
  repository: { externalId: z.string().regex(/^[1-9][0-9]{0,18}$/) },
};
