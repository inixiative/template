/**
 * @atlas
 * @kind validator
 * @partOf feature:integrations
 * @uses primitive:authz
 */
import { type HydratedRecord, hydrate } from '@template/db';
import { Role } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { delegatePermissionsOf } from '#/lib/permissions/ownerTable';
import { validateEntitlementGrants } from '#/lib/permissions/validateEntitlementGrants';

export const validateIntegrationGrant = async (
  writer: Permix,
  integration: Record<string, unknown>,
): Promise<void> => {
  const role = integration.full ? Role.owner : integration.role;
  if (role) {
    const pseudo = await hydrate('integration', { id: '', ...integration, role } as HydratedRecord);
    if (!check(writer, rebacSchema, 'integration', pseudo, 'assign'))
      throw makeError({ status: 403, message: 'Access denied' });
  }
  await validateEntitlementGrants(writer, delegatePermissionsOf(integration).entitlements ?? []);
};
