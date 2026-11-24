/**
 * @atlas
 * @kind schema
 * @partOf feature:integrations
 * @uses none
 */
import type { z } from 'zod';

export type ResourceKind = { externalId: z.ZodType<string> };
