/**
 * @atlas
 * @kind schema
 * @partOf feature:integrations
 * @uses none
 */
import { z } from 'zod';

export type ResourceKindDefinition = { externalId: z.ZodType<string> };

/** What one provider has: each resource kind it declares, by name. */
export type ProviderResourceKinds = Record<string, ResourceKindDefinition>;

export const providerIdentifierSchema = z
  .string()
  .min(1)
  .max(250)
  .regex(/^[a-zA-Z0-9_:@.-]+$/)
  .refine((id) => id !== '.' && id !== '..');

export const plainResourceKind: ResourceKindDefinition = { externalId: providerIdentifierSchema };
