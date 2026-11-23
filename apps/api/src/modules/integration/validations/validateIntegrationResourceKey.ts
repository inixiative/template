/**
 * @atlas
 * @kind validator
 * @partOf feature:integrations
 */
import type { Integration } from '@template/db/generated/client/client';
import { resourceKindDefinition } from '@template/shared/integrations/providerResourceKinds';
import { makeError } from '#/lib/errors';

export const validateIntegrationResourceKey = (
  integration: Pick<Integration, 'provider'>,
  kind: string,
  externalId: string,
) => {
  const definition = resourceKindDefinition(integration.provider, kind);
  if (!definition)
    throw makeError({
      status: 400,
      message: `A ${integration.provider} integration has no ${kind} resources`,
    });
  if (!definition.externalId.safeParse(externalId).success)
    throw makeError({ status: 400, message: `Not a ${integration.provider} ${kind} identifier` });
};
