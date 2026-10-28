/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import { createCanGrantEntitlement, type EntitlementEntry } from '@inixiative/permissions';
import type { HydratedRecord } from '@template/db';
import type { Permix } from '@template/permissions/client';
import { schemaMap } from '@template/permissions/rebac/check';
import { rebacSchema } from '@template/permissions/rebac/schema';

const canGrant = createCanGrantEntitlement(schemaMap);

export const canGrantEntitlement = (
  permix: Permix,
  entry: EntitlementEntry,
  placed: HydratedRecord,
): boolean => canGrant(permix, rebacSchema, entry, placed);
