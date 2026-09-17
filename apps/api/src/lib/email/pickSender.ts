/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { isNil } from 'lodash-es';
import type { SenderSpec } from '#/lib/email/registry';
import type { Sender } from '#/lib/email/sender';

export const pickSender = (spec: SenderSpec, entity: Record<string, unknown>): Sender =>
  Object.fromEntries(
    Object.entries(spec).map(([key, field]) => {
      if (key === 'type') return [key, field];
      const value = entity[field];
      if (isNil(value)) throw new Error(`Sender ${key} reads entity field "${field}", which is empty`);
      return [key, value];
    }),
  ) as Sender;
