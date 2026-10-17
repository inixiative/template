/**
 * @atlas
 * @kind utils
 * @partOf feature:segment
 * @uses none
 */
import { makeError } from '#/lib/errors';

export const invalidSegmentConditions = (errors: string[]) =>
  makeError({ status: 422, message: `Invalid segment conditions: ${errors.join('; ')}` });
