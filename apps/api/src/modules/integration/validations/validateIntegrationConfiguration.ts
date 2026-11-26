/**
 * @atlas
 * @kind validator
 * @partOf feature:integrations
 * @uses none
 */
import { findProvider } from '@inixiative/integrations/catalog/findProvider';
import { integrationConfigurationSchemas } from '@inixiative/integrations/resources/integrationConfigurationSchemas';
import type { Integration } from '@template/db/generated/client/client';
import { makeError } from '#/lib/errors';

export const validateIntegrationConfiguration = (integration: {
  provider?: Integration['provider'];
  configuration?: unknown;
}) => {
  if (integration.configuration === undefined || integration.configuration === null) return;
  const provider = findProvider(integration.provider);
  if (!provider)
    throw makeError({
      status: 422,
      message: `A ${integration.provider ?? 'provider-less'} integration takes no configuration`,
    });
  if (!integrationConfigurationSchemas[provider.key].safeParse(integration.configuration).success)
    throw makeError({ status: 422, message: `Invalid ${provider.key} configuration` });
};
