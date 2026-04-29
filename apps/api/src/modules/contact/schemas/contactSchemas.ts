import { ContactScalarInputSchema, ContactScalarSchema } from '@template/db';
import { z } from 'zod';

// Owner FKs are injected from the route parent; valueKey is hook-computed;
// verifiedAt comes from the verification flow. `value` is loose at the API
// boundary (URL paste, etc.); the contactRules hook normalizes it.
export const contactCreateBodySchema = ContactScalarInputSchema.omit({
  ownerModel: true,
  userId: true,
  organizationId: true,
  spaceId: true,
  valueKey: true,
  verifiedAt: true,
}).extend({
  // Loose at the API boundary; contactRules hook normalizes via type registry.
  value: z.any(),
  // Has @default in Prisma — opt-in on create.
  isPrimary: z.boolean().optional(),
});

export const contactUpdateBodySchema = contactCreateBodySchema.partial();

export const contactReadResponseSchema = ContactScalarSchema;
