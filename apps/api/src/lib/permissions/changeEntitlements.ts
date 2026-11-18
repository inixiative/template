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
  fetchEntitlementAnchors,
  includeTargetEntitlements,
  missingAnchors,
  toEntitlementCreateData,
} from '@template/db';
import type { Entitlement } from '@template/db/generated/client/client';
import {
  coversEntitlement,
  entitlementEntriesOfHolder,
  isSameEntitlement,
  type Permix,
  toEntitlementEntry,
  toEntitlementInput,
} from '@template/permissions';
import { isEqual, partition, uniq } from 'lodash-es';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import { validateEntitlementGrants } from '#/lib/permissions/validateEntitlementGrants';

export type EntitlementChanges = { add?: EntitlementInput[]; remove?: string[] };

type Holder = Record<string, unknown> & { id: string; targetEntitlements: Entitlement[] };

const liveRows = async (target: EntitlementTarget): Promise<Holder> => {
  const holder = (await db.delegate(target.model).findUnique({
    where: { id: target.id },
    include: includeTargetEntitlements(target.model),
  })) as Holder | null;
  if (!holder) throw makeError({ status: 404, message: `${target.model} not found` });
  return holder;
};

type Granted = Pick<
  EntitlementInput,
  'resource' | 'actions' | 'where' | 'sourceModel' | 'sourceId' | 'sourcePath' | 'lens'
>;

const sameLens = (left: Granted, right: Granted): boolean =>
  isEqual(left.lens ?? null, right.lens ?? null);

// why: no lens is the full surface, so a held row without one covers whatever lens the entry has.
const covers = (holding: Granted, input: Granted) =>
  (holding.lens == null || sameLens(holding, input)) &&
  coversEntitlement(toEntitlementEntry(holding), toEntitlementEntry(input));

const lastOfEqual = (add: EntitlementInput[]): EntitlementInput[] =>
  add.filter(
    (input, index) => !add.slice(index + 1).some((later) => isSameEntitlement(later, input)),
  );

// why: rows are immutable, so a held row a new entry covers stays; only the new entries are filtered.
const uncovered = (held: Granted[], added: EntitlementInput[]): EntitlementInput[] =>
  added.filter(
    (input, index) =>
      ![...held, ...added.slice(0, index)].some((holding) => covers(holding, input)),
  );

const asStored = (input: EntitlementInput): EntitlementInput => ({
  ...toEntitlementInput(toEntitlementEntry(input)),
  ...(input.lens != null ? { lens: input.lens } : {}),
});

/**
 * The one writer of a target's entitlements. Every added entry passes the grant check, and entries
 * a held row covers (with no lens, or the same lens) are skipped. A held row equal to an added
 * entry but for its lens is replaced: one grant holds one lens. A removal needs only what the
 * caller's route already checked, that the writer administers the holder: taking away never hands
 * on authority. A target left with no rows holds nothing. Rows never change; a removal is a soft
 * delete, so each row's audit entry is its own.
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
      if (
        holder.targetEntitlements.filter((row) => removedIds.includes(row.id)).length !==
        removedIds.length
      )
        throw makeError({ status: 404, message: 'Entitlement not found on this holder' });

      const written = lastOfEqual(add);
      const [replaced, kept] = partition(
        holder.targetEntitlements.filter(
          (row) =>
            !removedIds.includes(row.id) &&
            entitlementEntriesOfHolder({ targetEntitlements: [row] }).length > 0,
        ),
        (row) => written.some((input) => isSameEntitlement(row, input) && !sameLens(row, input)),
      );
      const tombstonedIds = [...removedIds, ...replaced.map((row) => row.id)];
      const removed = holder.targetEntitlements.filter((row) => tombstonedIds.includes(row.id));

      const anchors = await fetchEntitlementAnchors(written);
      const [missing] = missingAnchors(written, anchors);
      if (missing)
        throw makeError({
          status: 422,
          message: `${missing.sourceModel} ${missing.sourceId} not found`,
        });

      await validateEntitlementGrants(writer, written.map(toEntitlementEntry));

      const added = uncovered(kept, written);

      if (removed.length)
        await db.entitlement.updateManyAndReturn({
          where: { id: { in: tombstonedIds }, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      if (added.length)
        await db.entitlement.createManyAndReturn({
          data: toEntitlementCreateData(
            added.map(asStored),
            { model: target.model, row: holder },
            anchors,
          ),
        });

      return (await liveRows(target)).targetEntitlements;
    }),
  );
