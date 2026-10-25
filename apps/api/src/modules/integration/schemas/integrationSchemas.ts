/**
 * @atlas
 * @kind schema
 * @partOf feature:integrations
 * @uses primitive:authz
 */
import { z } from '@hono/zod-openapi';
import { IntegrationScalarInputSchema, IntegrationScalarSchema } from '@template/db';
import { Role } from '@template/db/generated/client/enums';
import { entitlementEntriesSchema } from '@template/permissions/rebac';

export const INTEGRATION_IMMUTABLE_FIELDS = [
  'ownerModel',
  'userId',
  'organizationId',
  'spaceId',
] as const;

export const integrationCreateBodySchema = IntegrationScalarInputSchema.omit({
  ownerModel: true,
  userId: true,
  organizationId: true,
  spaceId: true,
  role: true,
  entitlements: true,
});

export const integrationUpdateBodySchema = integrationCreateBodySchema
  .extend({
    role: z.nativeEnum(Role).nullable(),
    entitlements: entitlementEntriesSchema.nullable(),
  })
  .partial();

export const integrationReadResponseSchema = IntegrationScalarSchema;
