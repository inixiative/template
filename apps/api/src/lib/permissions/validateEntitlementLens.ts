/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses none
 */
import {
  type LensNarrowing,
  type ValidationResult,
  validateNarrowing,
} from '@inixiative/json-rules';
import { isCleared } from '@template/db';
import type { EntitlementResourceModel } from '@template/db/generated/client/enums';
import { lensFor } from '@template/db/lens';
import { visitsDroppingId } from '@template/permissions/lens/visitsDroppingId';
import { isPlainObject } from 'lodash-es';
import { makeError } from '#/lib/errors';

const malformed = (detail: string) =>
  makeError({ status: 422, message: `The entitlement lens is not a valid narrowing: ${detail}` });

const validated = (narrowing: LensNarrowing): ValidationResult => {
  try {
    return validateNarrowing(narrowing);
  } catch {
    throw malformed('a narrowing in it is not an object');
  }
};

/**
 * A stored lens is one json-rules narrowing over the resource's base lens, and it never removes
 * `id`, so the projections of every path a holder is admitted along can be merged by `id`.
 */
export const validateEntitlementLens = ({
  resource,
  lens,
}: {
  resource: EntitlementResourceModel;
  lens?: unknown;
}): void => {
  if (isCleared(lens)) return;
  if (!isPlainObject(lens)) throw malformed('it is not an object');
  const { root, mapDefaults } = lens as Pick<LensNarrowing, 'root' | 'mapDefaults'>;
  const narrowing: LensNarrowing = {
    parent: lensFor(resource),
    ...(root !== undefined ? { root } : {}),
    ...(mapDefaults !== undefined ? { mapDefaults } : {}),
  };
  const { ok, errors } = validated(narrowing);
  if (!ok) throw malformed(errors.map(({ path, message }) => `${path}: ${message}`).join('; '));
  const dropping = visitsDroppingId(narrowing);
  if (dropping.length)
    throw makeError({
      status: 422,
      message: `An entitlement lens always keeps id: ${dropping.join(', ')} does not show it`,
    });
};
