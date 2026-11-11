/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma, mutex
 */
import {
  db,
  type EntitlementInput,
  type EntitlementTarget,
  includeTargetEntitlements,
  resolveFalsePolymorphismRef,
  toEntitlementCreateData,
} from '@template/db';
import type { Entitlement } from '@template/db/generated/client/client';
import {
  coversEntitlement,
  type EntitlementEntry,
  entitlementsOf,
  type Permix,
  toEntitlementEntry,
  toEntitlementInput,
} from '@template/permissions';
import { partition, uniq } from 'lodash-es';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import { validateEntitlementGrants } from '#/lib/permissions/validateEntitlementGrants';

export type EntitlementChanges = { add?: EntitlementInput[]; remove?: string[] };

type Holder = { targetEntitlements: Entitlement[] };

const anchorIsHardDeleted = (row: Entitlement): boolean => {
  const column = resolveFalsePolymorphismRef({
    model: 'Entitlement',
    axis: 'sourceModel',
    value: row.sourceModel,
  });
  return !column || row[column as keyof Entitlement] == null;
};

const liveRows = async (target: EntitlementTarget): Promise<Holder> => {
  const holder = (await db.delegate(target.model).findUnique({
    where: { id: target.id },
    include: includeTargetEntitlements,
  })) as Holder | null;
  if (!holder) throw makeError({ status: 404, message: `${target.model} not found` });
  return holder;
};

// why: rows are immutable, so a held row a new entry covers stays; only the new entries are filtered.
const uncovered = (held: EntitlementEntry[], added: EntitlementEntry[]): EntitlementEntry[] =>
  added.filter(
    (entry, index) =>
      ![...held, ...added.slice(0, index)].some((holding) => coversEntitlement(holding, entry)),
  );

/**
 * The one writer of a target's entitlements: every added entry and every removed row passes the
 * grant check, and entries already covered are skipped. A target left with no rows holds nothing.
 * Rows never change; a removal is a soft delete, so each row's audit entry is its own.
 */
export const changeEntitlements = (
  writer: Permix,
  target: EntitlementTarget,
  { add = [], remove = [] }: EntitlementChanges,
): Promise<Entitlement[]> =>
  db.txn(() =>
    withOwnerLock({ ownerModel: target.model, ownerId: target.id }, 'entitlements', async () => {
      const holder = await liveRows(target);
      const removedIds = uniq(remove);
      const removed = holder.targetEntitlements.filter((row) => removedIds.includes(row.id));
      if (removed.length !== removedIds.length)
        throw makeError({ status: 404, message: 'Entitlement not found on this holder' });

      const checked = removed.filter((row) => !anchorIsHardDeleted(row));
      const [anchoredLive, anchoredDeleted] = partition(
        checked,
        (row) => row.sourceDeletedAt == null,
      );
      const addedEntries = add.map(toEntitlementEntry);
      await validateEntitlementGrants(writer, [
        ...addedEntries,
        ...anchoredLive.map(toEntitlementEntry),
      ]);
      await db.withDeleted(() =>
        validateEntitlementGrants(writer, anchoredDeleted.map(toEntitlementEntry)),
      );

      const kept = entitlementsOf({
        targetEntitlements: holder.targetEntitlements.filter((row) => !removedIds.includes(row.id)),
      });
      const added = uncovered(kept, addedEntries);

      if (removed.length)
        await db.entitlement.updateManyAndReturn({
          where: { id: { in: removedIds }, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      if (added.length)
        await db.entitlement.createManyAndReturn({
          data: added.map((entry) => toEntitlementCreateData(toEntitlementInput(entry), target)),
        });

      return (await liveRows(target)).targetEntitlements;
    }),
  );
