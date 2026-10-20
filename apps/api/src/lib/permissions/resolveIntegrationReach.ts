/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz, feature:integrations
 * @uses primitive:errors, infrastructure:prisma
 */
import { IntegrationReach } from '@template/db/generated/client/enums';
import { defaultIntegrationReach, type IntegrationBinding } from '@template/permissions';
import { uniq } from 'lodash-es';
import { makeError } from '#/lib/errors';
import { findOwnedIntegration } from '#/modules/integration/services/findOwnedIntegration';
import { integrationOwnerScope } from '#/modules/integration/services/integrationOwnerScope';

export type RequestedIntegrationReach = {
  integrationReach?: IntegrationReach;
  integrationReachIds?: string[];
};

export const resolveIntegrationReach = async (
  requested: RequestedIntegrationReach,
  integrationId: string | null,
  owner: Parameters<typeof integrationOwnerScope>[0],
): Promise<Omit<IntegrationBinding, 'integrationId'>> => {
  const integrationReach = requested.integrationReach ?? defaultIntegrationReach(integrationId);
  const integrationReachIds = uniq(requested.integrationReachIds ?? []);
  const invalid = (message: string) => makeError({ status: 422, message });

  if (integrationReach !== IntegrationReach.listed && integrationReachIds.length)
    throw invalid('integrationReachIds go only with integrationReach "listed"');
  if (integrationReach === IntegrationReach.own && !integrationId)
    throw invalid('integrationReach "own" needs a credential bound to an integration');
  if (integrationReach === IntegrationReach.listed) {
    if (!integrationReachIds.length)
      throw invalid(
        'integrationReach "listed" names at least one integration in integrationReachIds',
      );
    const scope = await integrationOwnerScope(owner);
    const owned = await Promise.all(
      integrationReachIds.map((id) => findOwnedIntegration(id, scope)),
    );
    const foreign = integrationReachIds.filter((_, index) => !owned[index]);
    if (foreign.length)
      throw invalid(`Not integrations of this credential's owner: ${foreign.join(', ')}`);
  }

  return { integrationReach, integrationReachIds };
};
