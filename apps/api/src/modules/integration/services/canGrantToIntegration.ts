/**
 * @atlas
 * @kind service
 * @partOf feature:integrations
 * @uses primitive:authz, infrastructure:prisma
 */
import { type AccessorName, fetchOne, hydrate } from '@template/db';
import type { Integration, Role } from '@template/db/generated/client/client';
import { narrowing, type Permix } from '@template/permissions';
import { canGrantEntitlement, type StoredEntitlement } from '@template/permissions/rebac';
import { integrationAnchor } from '#/lib/permissions/setupIntegrationPermissions';

type Grant = { role?: Role | null; entitlements?: StoredEntitlement[] | null };

const positionOf = async ({ resource, id }: StoredEntitlement['from']) => {
  const model = resource.slice('db:'.length) as AccessorName;
  const row = await fetchOne<{ id: string }>(model, id);
  return row ? hydrate(model, row) : null;
};

const grantable = async (permix: Permix, entry: StoredEntitlement) => {
  const position = await positionOf(entry.from);
  return position !== null && canGrantEntitlement(permix, entry, position);
};

/** A grant is an action: the writer could take every action the integration would hold. */
export const canGrantToIntegration = async (
  permix: Permix,
  integration: Integration,
  { role, entitlements }: Grant,
): Promise<boolean> => {
  const anchor = integrationAnchor(integration);
  const roleClaim = role && anchor ? narrowing(anchor.resource, anchor.id, role, null, null) : null;
  if (role && !roleClaim) return false;

  const claims = [...(roleClaim ? [roleClaim as StoredEntitlement] : []), ...(entitlements ?? [])];
  for (const entry of claims) if (!(await grantable(permix, entry))) return false;
  return true;
};
