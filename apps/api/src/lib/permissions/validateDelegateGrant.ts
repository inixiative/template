/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { type AccessorName, fetchOne, hydrate } from '@template/db';
import {
  type DelegateClaim,
  delegateClaimEntries,
  type EntitlementEntry,
  type Permix,
} from '@template/permissions';
import { canGrantEntitlement } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { type DelegateHolder, holderPermix } from '#/lib/permissions/delegateHolder';

const positionRecord = async ({ resource, id }: EntitlementEntry['from']) => {
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
  const position = await positionRecord(entry.from);
  if (!position)
    throw makeError({
      status: 422,
      message: `No ${entry.from.resource} ${entry.from.id} to grant from`,
    });
  const claimed = Object.keys(entry.actions as Record<string, boolean | undefined>).filter(
    (action) => (entry.actions as Record<string, boolean | undefined>)[action] === true,
  );
  const wouldHold = held
    ? claimed.filter((action) => canGrantEntitlement(held, only(entry, [action]), position))
    : claimed;
  return !wouldHold.length || canGrantEntitlement(writer, only(entry, wouldHold), position);
};

export const validateDelegateGrant = async (
  writer: Permix,
  holder: DelegateHolder,
  claim: DelegateClaim,
): Promise<void> => {
  const held = await holderPermix(holder);
  const ceiling = delegateClaimEntries({ ...claim, entitlements: null }, holder.entries);
  const named = claim.entitlements ?? [];
  const within = async () => {
    for (const entry of ceiling) if (!(await grantable(writer, entry, held))) return false;
    for (const entry of named) if (!(await grantable(writer, entry, null))) return false;
    return true;
  };
  if (!(await within()))
    throw makeError({ status: 403, message: 'A delegate holds your permissions or less' });
};
