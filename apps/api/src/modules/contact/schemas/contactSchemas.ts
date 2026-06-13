/**
 * @atlas
 * @kind schema
 * @partOf feature:contact
 * @uses primitive:authz
 */
import { ContactScalarInputSchema, ContactScalarSchema } from '@template/db';
import { CommunicationKindSchema } from '@template/db/zod/enums/CommunicationKind.schema';
import { buildPermissionRulesSchema } from '@template/permissions/rebac/permissionRulesSchema';
import { z } from 'zod';

// Stripped from inbound bodies on every Contact write:
// - ownerModel + the FK fields are the polymorphic owner — clients flipping
//   them effectively transfers rows across owners; routes inject from auth
// - valueKey is hook-computed from `value`
// - verifiedAt is owned by the verification flow
export const CONTACT_CREATE_IMMUTABLE_FIELDS = [
  'ownerModel',
  'userId',
  'organizationId',
  'spaceId',
  'valueKey',
  'verifiedAt',
] as const;

// Update-only addition: `type` drives valueKey/registry parsing — flipping
// it after create silently breaks (ownerModel, ..., type, valueKey)
// uniqueness and would re-derive valueKey under a different schema.
export const CONTACT_UPDATE_IMMUTABLE_FIELDS = ['type', ...CONTACT_CREATE_IMMUTABLE_FIELDS] as const;

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
  acceptedKinds: true,
}).extend({
  permissionRules: buildPermissionRulesSchema('contact', ['read']),
  // Optional override of the DB default ['platform', 'activity']; otherwise applied at insert.
  acceptedKinds: z.array(CommunicationKindSchema).optional(),
});

export const contactUpdateBodySchema = contactCreateBodySchema.partial();

export const contactReadResponseSchema = ContactScalarSchema;
