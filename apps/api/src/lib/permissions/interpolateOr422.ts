/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses primitive:errors
 */
import { BindError, type BindRoots, type Entitlements } from '@template/permissions';
import { makeError } from '#/lib/errors';

export const interpolateOr422 = (
  interpolate: (entitlements: Entitlements, values: BindRoots) => Entitlements,
  entitlements: Entitlements,
  values: BindRoots,
): Entitlements => {
  try {
    return interpolate(entitlements, values);
  } catch (error) {
    if (error instanceof BindError) throw makeError({ status: 422, message: error.message });
    throw error;
  }
};
