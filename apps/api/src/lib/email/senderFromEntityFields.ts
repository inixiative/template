/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses none
 */
import { isNil, mapValues } from 'lodash-es';
import type { Sender } from '#/lib/email/sender';

export const senderFromEntityFields = (spec: Sender, entity: Record<string, unknown>): Sender =>
  mapValues(spec, (field, key) => {
    if (key === 'type') return field;
    const value = entity[field];
    if (isNil(value))
      throw new Error(`Sender ${key} reads entity field "${field}", which is empty`);
    return value;
  }) as Sender;
