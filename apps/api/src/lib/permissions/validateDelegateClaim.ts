/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses primitive:errors
 */
import type { DelegateClaim } from '@template/permissions';
import { makeError } from '#/lib/errors';

const ownersOfThemselves = ['Organization', 'Space'];

export const validateDelegateClaim = (ownerModel: string, claim: DelegateClaim): void => {
  if (!claim.full) return;
  if (claim.role || claim.entitlements?.length)
    throw makeError({ status: 422, message: 'full takes no role and no entitlements beside it' });
  if (ownersOfThemselves.includes(ownerModel))
    throw makeError({
      status: 422,
      message: `full passes a holder through; an ${ownerModel} holds itself, so give it a role`,
    });
};
