/**
 * @atlas
 * @kind validator
 * @partOf feature:integrations
 * @uses primitive:authz
 */
import { type HydratedRecord, hydrate } from '@template/db';
import type { Permix } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import { integrationRoleWrite } from '@template/permissions/rebac/schemaHelpers';
import { makeError } from '#/lib/errors';
import { delegatePermissionsOf } from '#/lib/permissions/ownerTable';
import { validateEntitlementGrants } from '#/lib/permissions/validateEntitlementGrants';
import { validateFullGrant } from '#/lib/permissions/validateFullGrant';

export const validateIntegrationGrant = async (
  writer: Permix,
  integration: Record<string, unknown>,
): Promise<void> => {
  const pseudo = await hydrate('integration', { id: '', ...integration } as HydratedRecord);
  if (integration.full) validateFullGrant(writer, 'integration', pseudo);
  else if (
    integration.role &&
    !check(writer, rebacSchema, 'integration', pseudo, integrationRoleWrite)
  )
    throw makeError({ status: 403, message: 'Access denied' });
  await validateEntitlementGrants(writer, delegatePermissionsOf(integration).entitlements ?? []);
};
