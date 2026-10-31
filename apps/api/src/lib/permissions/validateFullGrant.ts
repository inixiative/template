/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses primitive:errors
 */
import type { AccessorName, HydratedRecord } from '@template/db';
import type { Permix } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import {
  actionOnOwner,
  actorHoldsItsChain,
  ownedBy,
} from '@template/permissions/rebac/schemaHelpers';
import { makeError } from '#/lib/errors';

export const validateFullGrant = (
  writer: Permix,
  model: AccessorName,
  delegate: HydratedRecord,
): void => {
  if (
    !check(writer, rebacSchema, model, delegate, {
      any: [
        actorHoldsItsChain,
        actionOnOwner('own', '', ['Organization', 'Space']),
        ownedBy(['Integration']),
      ],
    })
  )
    throw makeError({ status: 403, message: 'Access denied' });
};
