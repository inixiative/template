import { db, type EntitlementInput, type EntitlementTarget, toAccessor } from '@template/db';
import type { Entitlement } from '@template/db/generated/client/client';
import { toEntitlementEntry, toEntitlementInput } from '@template/permissions';
import { isEqual } from 'lodash-es';
import { del, post } from '#tests/utils/request';

type Fetch = { fetch: (request: Request) => Promise<Response> };

/** A stored row as the input that writes it: no where or path when it has none. */
export const asInput = (row: Entitlement): EntitlementInput =>
  toEntitlementInput(toEntitlementEntry(row));

const liveRows = (target: EntitlementTarget) =>
  db.entitlement.findMany({
    where: { targetModel: target.model, targetId: target.id, deletedAt: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

/** The rows a target holds now, as inputs, in the order they were granted. */
export const heldEntitlements = async (target: EntitlementTarget): Promise<EntitlementInput[]> =>
  (await liveRows(target)).map(asInput);

/** The ids of the target's live rows that store these inputs. */
export const entitlementIds = async (
  target: EntitlementTarget,
  inputs: EntitlementInput[],
): Promise<string[]> =>
  (await liveRows(target))
    .filter((row) => inputs.some((input) => isEqual(asInput(row), input)))
    .map((row) => row.id);

const routeOf = (target: EntitlementTarget) =>
  `/api/v1/${toAccessor(target.model)}/${target.id}/entitlements`;

export const grantEntitlements = (app: Fetch, target: EntitlementTarget, add: EntitlementInput[]) =>
  app.fetch(post(routeOf(target), add));

export const revokeEntitlements = (app: Fetch, target: EntitlementTarget, ids: string[]) =>
  app.fetch(del(routeOf(target), undefined, ids));

/** Removes the rows storing `remove`, then grants `add`; answers with the first refusal. */
export const changeEntitlements = async (
  app: Fetch,
  target: EntitlementTarget,
  { add = [], remove = [] }: { add?: EntitlementInput[]; remove?: EntitlementInput[] },
): Promise<Response> => {
  if (remove.length) {
    const removed = await revokeEntitlements(app, target, await entitlementIds(target, remove));
    if (!removed.ok || !add.length) return removed;
  }
  return grantEntitlements(app, target, add);
};
