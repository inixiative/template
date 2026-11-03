import { db, type EntitlementTarget, toAccessor, toEntitlementEntry } from '@template/db';
import type { EntitlementEntry } from '@template/permissions';
import { isEqual } from 'lodash-es';
import type { Entry } from '#tests/utils/entitlementEntry';
import { del, post } from '#tests/utils/request';

type Fetch = { fetch: (request: Request) => Promise<Response> };

/** The entries a target holds now, in the order they were granted. */
export const heldEntitlements = async (target: EntitlementTarget): Promise<EntitlementEntry[]> =>
  (
    await db.entitlement.findMany({
      where: { targetModel: target.model, targetId: target.id, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
  ).map(toEntitlementEntry);

/** The ids of the target's live rows that store these entries. */
export const entitlementIds = async (
  target: EntitlementTarget,
  entries: (Entry | EntitlementEntry)[],
): Promise<string[]> =>
  (
    await db.entitlement.findMany({
      where: { targetModel: target.model, targetId: target.id, deletedAt: null },
    })
  )
    .filter((row) => entries.some((entry) => isEqual(toEntitlementEntry(row), entry)))
    .map((row) => row.id);

const routeOf = (target: EntitlementTarget) =>
  `/api/v1/${toAccessor(target.model)}/${target.id}/entitlements`;

export const grantEntitlements = (
  app: Fetch,
  target: EntitlementTarget,
  add: (Entry | EntitlementEntry)[],
) => app.fetch(post(routeOf(target), add));

export const revokeEntitlements = (app: Fetch, target: EntitlementTarget, ids: string[]) =>
  app.fetch(del(routeOf(target), undefined, ids));

/** Removes the rows storing `remove`, then grants `add`; answers with the first refusal. */
export const changeEntitlements = async (
  app: Fetch,
  target: EntitlementTarget,
  { add = [], remove = [] }: { add?: Entry[]; remove?: Entry[] },
): Promise<Response> => {
  if (remove.length) {
    const removed = await revokeEntitlements(app, target, await entitlementIds(target, remove));
    if (!removed.ok || !add.length) return removed;
  }
  return grantEntitlements(app, target, add);
};
