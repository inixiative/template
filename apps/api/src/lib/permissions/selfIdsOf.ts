/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { SelfIds } from '@template/permissions';
import type { IntegrationWithOwners } from '#/lib/context/types';

export const integrationSelfIds = (integration: IntegrationWithOwners): SelfIds => ({
  integration: integration.id,
  user: integration.userId ?? undefined,
  organization: integration.organizationId ?? undefined,
  space: integration.spaceId ?? undefined,
  organizationUser: integration.organizationUser?.id,
  spaceUser: integration.spaceUser?.id,
});
