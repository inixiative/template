/**
 * @atlas
 * @kind validator
 * @partOf feature:integrations
 * @uses none
 */
import { findProvider } from '@inixiative/integrations/catalog/findProvider';
import { resourceExternalIdSchema } from '@inixiative/integrations/resources/resourceExternalIdSchema';
import { resourceMetadataSchema } from '@inixiative/integrations/resources/resourceMetadataSchema';
import type { Integration } from '@template/db/generated/client/client';
import { makeError } from '#/lib/errors';

export const validateIntegrationResource = (
  integration: Pick<Integration, 'provider'>,
  resource: { kind: string; externalId: string; metadata?: unknown },
) => {
  const provider = findProvider(integration.provider);
  if (!provider?.operations.some((operation) => operation.resourceKind === resource.kind))
    throw makeError({
      status: 422,
      message: `A ${integration.provider ?? 'provider-less'} integration has no ${resource.kind} resources`,
    });
  if (!resourceExternalIdSchema(provider.key).safeParse(resource.externalId).success)
    throw makeError({
      status: 422,
      message: `Not a ${provider.key} ${resource.kind} identifier`,
    });
  if (!resourceMetadataSchema(provider.key).safeParse(resource.metadata ?? {}).success)
    throw makeError({
      status: 422,
      message: `Not ${provider.key} ${resource.kind} metadata`,
    });
};
