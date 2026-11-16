import type { EntitlementInput } from '@template/db';
import { type EntitlementEntry, toEntitlementInput } from '@template/permissions';

export type Entry = EntitlementInput;

export const entry = (
  resource: string,
  [anchorResource, id, path]: [string, string, string?],
  actions: string[],
  where?: EntitlementEntry['where'],
): Entry =>
  toEntitlementInput({
    resource,
    anchor: { resource: anchorResource, id, ...(path ? { path } : {}) },
    actions: Object.fromEntries(actions.map((action) => [action, true])),
    ...(where ? { where } : {}),
  });
