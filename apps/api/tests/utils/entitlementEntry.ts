import type { EntitlementInput } from '@template/db';
import { toEntitlementInput } from '@template/permissions';

export type Entry = EntitlementInput;

export const entry = (
  resource: string,
  [anchorResource, id, path]: [string, string, string?],
  actions: string[],
): Entry =>
  toEntitlementInput({
    resource,
    anchor: { resource: anchorResource, id, ...(path ? { path } : {}) },
    actions: Object.fromEntries(actions.map((action) => [action, true])),
  });
