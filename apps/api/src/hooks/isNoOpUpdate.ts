import { filterIgnoredFields } from '@template/db';
import { isEqual } from 'lodash-es';

export const isNoOpUpdate = <T extends Record<string, unknown>>(
  model: string,
  currentData: T,
  previousData: T | undefined,
): boolean => {
  if (!previousData) return false;

  const current = filterIgnoredFields(model, currentData);
  const previous = filterIgnoredFields(model, previousData);

  return isEqual(current, previous);
};
