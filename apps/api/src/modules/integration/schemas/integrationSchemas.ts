/**
 * @atlas
 * @kind schema
 * @partOf feature:integrations
 * @uses primitive:authz
 */
import { IntegrationScalarInputSchema, IntegrationScalarSchema } from '@template/db';

export const INTEGRATION_IMMUTABLE_FIELDS = ['ownerModel', 'userId', 'organizationId', 'spaceId'] as const;

export const integrationCreateBodySchema = IntegrationScalarInputSchema.omit({
  ownerModel: true,
  userId: true,
  organizationId: true,
  spaceId: true,
});

export const integrationUpdateBodySchema = integrationCreateBodySchema.partial();

export const integrationReadResponseSchema = IntegrationScalarSchema;
