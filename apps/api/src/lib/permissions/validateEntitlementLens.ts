/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses none
 */
import type { EntitlementInput } from '@template/db';
import { lensFor } from '@template/db/lens';
import {
  type EntitlementLens,
  narrowingsDroppingId,
} from '@template/permissions/lens/narrowingsDroppingId';
import { isPlainObject } from 'lodash-es';
import { makeError } from '#/lib/errors';

/** A lens never removes `id`, so the projections of every path a holder is admitted by merge by `id`. */
export const validateEntitlementLens = ({ resource, lens }: EntitlementInput): void => {
  if (lens == null) return;
  if (!isPlainObject(lens))
    throw makeError({ status: 422, message: 'A lens is a json-rules narrowing object' });
  const dropping = narrowingsDroppingId(lensFor(resource), lens as EntitlementLens);
  if (dropping.length)
    throw makeError({
      status: 422,
      message: `A lens always keeps id: ${dropping.join(', ')} omits it or picks without it`,
    });
};
