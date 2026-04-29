import { ContactScalarInputSchema, ContactScalarSchema } from '@template/db';
import { buildPermissionRulesSchema } from '@template/permissions/rebac/permissionRulesSchema';
import { z } from 'zod';

// Actions whose row-level rules a contact owner may set. `read` is the
// sharing primitive (grant additional read paths). manage/delete are kept
// strictly owner-gated — granting them via row rules effectively transfers
// ownership, which we don't want via this surface.
const CONTACT_ROW_OVERRIDABLE_ACTIONS = ['read'] as const;

// Omit server-authored / hook-computed / route-injected fields. Client may
// supply `permissionRules` for the whitelisted action set above; arbitrary
// rebac JSON is rejected at the boundary.
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
  permissionRules: buildPermissionRulesSchema(CONTACT_ROW_OVERRIDABLE_ACTIONS),
});

export const contactUpdateBodySchema = contactCreateBodySchema.partial();

export const contactReadResponseSchema = ContactScalarSchema;
