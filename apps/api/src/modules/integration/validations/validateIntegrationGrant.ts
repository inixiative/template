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

export const validateIntegrationRole = async (
  writer: Permix,
  integration: Record<string, unknown>,
): Promise<HydratedRecord> => {
  const record = await hydrate('integration', { id: '', ...integration } as HydratedRecord);
  if (integration.full) validateFullGrant(writer, 'integration', record);
  else if (!check(writer, rebacSchema, 'integration', record, integrationRoleWrite))
    throw makeError({ status: 403, message: 'Access denied' });
  return record;
};

export const validateIntegrationGrant = async (
  writer: Permix,
  integration: Record<string, unknown>,
): Promise<void> => {
  const record = await validateIntegrationRole(writer, integration);
  await validateEntitlementGrants(writer, delegatePermissionsOf(integration).entitlements ?? [], {
    model: 'integration',
    record,
  });
};
