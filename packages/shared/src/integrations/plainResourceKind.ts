/**
 * @atlas
 * @kind schema
 * @partOf feature:integrations
 * @uses none
 */
import type { ResourceKind } from '@template/shared/integrations/resourceKind';
import { z } from 'zod';

export const plainResourceKind: ResourceKind = {
  externalId: z
    .string()
    .regex(/^[a-zA-Z0-9_:@.-]+$/)
    .refine((id) => id !== '.' && id !== '..'),
};
