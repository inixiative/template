/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { type AccessorName, fetchOne, hydrate } from '@template/db';
import {
  type DelegatePermissions,
  delegateEntries,
  type EntitlementEntry,
  type Permix,
} from '@template/permissions';
import { canGrantEntitlement } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { type OwnerTable, ownerPermix } from '#/lib/permissions/ownerTable';

const anchorRecord = async ({ resource, id }: EntitlementEntry['anchor']) => {
  const model = resource.slice('db:'.length) as AccessorName;
  const row = await fetchOne<{ id: string }>(model, id);
  return row ? hydrate(model, row) : null;
};

const only = (entry: EntitlementEntry, actions: string[]): EntitlementEntry => ({
  ...entry,
  actions: Object.fromEntries(actions.map((action) => [action, true])),
});

const grantable = async (
  writer: Permix,
  entry: EntitlementEntry,
  held: Permix | null,
): Promise<boolean> => {
  const anchor = await anchorRecord(entry.anchor);
  if (!anchor)
    throw makeError({
      status: 422,
      message: `No ${entry.anchor.resource} ${entry.anchor.id} to grant from`,
    });
  const claimed = Object.keys(entry.actions as Record<string, boolean | undefined>).filter(
    (action) => (entry.actions as Record<string, boolean | undefined>)[action] === true,
  );
  const wouldHold = held
    ? claimed.filter((action) => canGrantEntitlement(held, only(entry, [action]), anchor))
    : claimed;
  return !wouldHold.length || canGrantEntitlement(writer, only(entry, wouldHold), anchor);
};

export const validateDelegateGrant = async (
  writer: Permix,
  table: OwnerTable,
  permissions: DelegatePermissions,
): Promise<void> => {
  const held = await ownerPermix(table);
  const ceiling = delegateEntries({ ...permissions, entitlements: null }, table.entries);
  const named = permissions.entitlements ?? [];
  const within = async () => {
    for (const entry of ceiling) if (!(await grantable(writer, entry, held))) return false;
    for (const entry of named) if (!(await grantable(writer, entry, null))) return false;
    return true;
  };
  if (!(await within()))
    throw makeError({ status: 403, message: 'A delegate holds your permissions or less' });
};
