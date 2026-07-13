import { filterFields, WEBHOOK_DROP_FIELDS } from '@template/db';
import { isEqual } from 'lodash-es';

export const isNoOpUpdate = <T extends Record<string, unknown>>(
  model: string,
  currentData: T,
  previousData: T | undefined,
): boolean => {
  if (!previousData) return false;

  const current = filterFields(model, currentData, WEBHOOK_DROP_FIELDS);
  const previous = filterFields(model, previousData, WEBHOOK_DROP_FIELDS);

  return isEqual(current, previous);
};
