/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { AccessorName, HydratedRecord } from '@template/db';
import type { Entitlements, Permix } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';

export type HeldOn = { model: AccessorName; record: HydratedRecord };

export const findUnheldActions = (
  permix: Permix,
  heldOn: HeldOn[],
  entitlements: Entitlements | undefined,
): string[] =>
  Object.keys(entitlements ?? {}).filter(
    (action) =>
      entitlements?.[action] === true &&
      !heldOn.some(({ model, record }) => check(permix, rebacSchema, model, record, action)),
  );
