/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses primitive:errors
 */
import type { Entitlements, Permix } from '@template/permissions';
import { makeError } from '#/lib/errors';
import { findUnheldActions, type HeldOn } from '#/lib/permissions/findUnheldActions';

export const validateHeldActions = (
  permix: Permix,
  heldOn: HeldOn[],
  entitlements: Entitlements | undefined,
): void => {
  const unheld = findUnheldActions(permix, heldOn, entitlements);
  if (unheld.length)
    throw makeError({
      status: 403,
      message: `Cannot grant actions you do not hold: ${unheld.join(', ')}`,
    });
};
