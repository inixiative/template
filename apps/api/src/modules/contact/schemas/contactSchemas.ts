import { ContactScalarInputSchema, ContactScalarSchema } from '@template/db';
import { buildPermissionRulesSchema } from '@template/permissions/rebac/permissionRulesSchema';
import { z } from 'zod';

// Server-authored / hook-computed / route-injected fields are omitted.
// `permissionRules` is replaced with a validated schema picked from the
// rebac actions for `contact`. Only `read` is exposed for row-level
// override — granting manage/delete via row rules effectively transfers
// ownership, kept owner-gated.
export const contactCreateBodySchema = ContactScalarInputSchema.omit({
  ownerModel: true,
  userId: true,
  organizationId: true,
  spaceId: true,
  valueKey: true,
  verifiedAt: true,
  permissionRules: true,
}).extend({
  value: z.any(),
  isPrimary: z.boolean().optional(),
  permissionRules: buildPermissionRulesSchema('contact', ['read']),
});

export const contactUpdateBodySchema = contactCreateBodySchema.partial();

export const contactReadResponseSchema = ContactScalarSchema;
