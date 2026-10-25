/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import { createCanGrantEntitlement, type EntitlementEntry } from '@inixiative/permissions';
import type { HydratedRecord } from '@template/db';
import type { Permix } from '@template/permissions/client';
import { resolveRelation } from '@template/permissions/rebac/check';
import { rebacSchema } from '@template/permissions/rebac/schema';

const canGrant = createCanGrantEntitlement(resolveRelation);

/** A grant is an action: the writer could take every action `entry` names, from `position`. */
export const canGrantEntitlement = (
  permix: Permix,
  entry: EntitlementEntry,
  position: HydratedRecord,
): boolean => canGrant(permix, rebacSchema, entry, position);
