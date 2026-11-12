/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';
import type { EntitlementInput } from '@template/db/entitlements/entitlementRow';
import type { Prisma } from '@template/db/generated/client/client';
import type { EntitlementResourceModel } from '@template/db/generated/client/enums';
import { type EntitlementEntry, wellFormedEntitlements } from '@template/permissions/client';
import { isEqual, lowerFirst, upperFirst } from 'lodash-es';

/** A row as stored, written, or serialized to a client: what the transformer reads. */
export type EntitlementFields = {
  resource: string;
  actions: string[];
  where?: unknown;
  sourceModel: string;
  sourceId: string;
  sourcePath?: string | null;
};

const resourceOf = (model: string): string => `db:${lowerFirst(model)}`;

const modelOf = (resource: string): EntitlementResourceModel =>
  upperFirst(resource.slice('db:'.length)) as EntitlementResourceModel;

/** A row as the library reads it: no path or where when the row has none, actions as a map. */
export const toEntitlementEntry = (row: EntitlementFields): EntitlementEntry => ({
  resource: resourceOf(row.resource),
  anchor: {
    resource: resourceOf(row.sourceModel),
    id: row.sourceId,
    ...(row.sourcePath ? { path: row.sourcePath } : {}),
  },
  ...(row.where != null ? { where: row.where as Condition } : {}),
  actions: Object.fromEntries(row.actions.map((action) => [action, true])),
});

/** Two rows grant the same thing: same resource, anchor and path, `where` and actions. A lens is not part of it. */
export const sameEntitlement = (left: EntitlementFields, right: EntitlementFields): boolean =>
  isEqual(toEntitlementEntry(left), toEntitlementEntry(right));

/** An entry the library hands back (a self-grant), as the row a writer stores: held actions only. */
export const toEntitlementInput = (entry: EntitlementEntry): EntitlementInput => ({
  resource: modelOf(entry.resource),
  actions: Object.entries(entry.actions)
    .filter(([, held]) => held === true)
    .map(([action]) => action),
  ...(entry.where !== undefined ? { where: entry.where as Prisma.InputJsonValue } : {}),
  sourceModel: modelOf(entry.anchor.resource),
  sourceId: entry.anchor.id,
  ...(entry.anchor.path ? { sourcePath: entry.anchor.path } : {}),
});

/** The well-formed entries a holder's live rows grant, for the library's checks. */
export const entitlementsOf = (holder: {
  targetEntitlements?: EntitlementFields[] | null;
}): EntitlementEntry[] =>
  wellFormedEntitlements((holder.targetEntitlements ?? []).map(toEntitlementEntry));
