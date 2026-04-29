import { ContactScalarInputSchema, ContactScalarSchema } from '@template/db';
import { z } from 'zod';

// Omit server-authored / hook-computed / route-injected fields:
//   - owner FKs come from the route parent (me / org / space)
//   - valueKey is computed by the contactRules hook
//   - verifiedAt comes from the verification flow
//   - permissionRules is server-authored; clients must not write raw rebac JSON
export const contactCreateBodySchema = ContactScalarInputSchema.omit({
  ownerModel: true,
  userId: true,
  organizationId: true,
  spaceId: true,
  valueKey: true,
  verifiedAt: true,
  permissionRules: true,
}).extend({
  // Loose at the API boundary; contactRules hook normalizes via type registry.
  value: z.any(),
  // Has @default in Prisma — opt-in on create.
  isPrimary: z.boolean().optional(),
});

export const contactUpdateBodySchema = contactCreateBodySchema.partial();

export const contactReadResponseSchema = ContactScalarSchema;
