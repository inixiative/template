/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses primitive:errors
 */
import { type AccessorName, type HydratedRecord, toAccessor } from '@template/db';
import type { Permix } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';

export const validateFullGrant = (
  writer: Permix,
  model: AccessorName,
  delegate: HydratedRecord,
): void => {
  if (
    !check(writer, rebacSchema, model, delegate, {
      rel: toAccessor(delegate.ownerModel as string),
      action: 'delegateFull',
    })
  )
    throw makeError({ status: 403, message: 'Access denied' });
};
