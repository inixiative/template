/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import { createCanGrantEntitlement, type EntitlementEntry } from '@inixiative/permissions';
import type { HydratedRecord } from '@template/db';
import type { Permix } from '@template/permissions/client';
import { ownerAnchor, resolveRelation } from '@template/permissions/rebac/check';
import { rebacSchema } from '@template/permissions/rebac/schema';

const canGrant = createCanGrantEntitlement(resolveRelation, { directOwner: ownerAnchor });

export const canGrantEntitlement = (
  permix: Permix,
  entry: EntitlementEntry,
  placed: HydratedRecord,
): boolean => canGrant(permix, rebacSchema, entry, placed);
