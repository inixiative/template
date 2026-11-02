/**
 * @atlas
 * @kind utils
 * @uses none
 */
import { castArray } from 'lodash-es';

export const extractRows = (args: unknown): Record<string, unknown>[] => {
  if (!args || typeof args !== 'object') return [];
  const a = args as Record<string, unknown>;
  if (a.data === undefined) return [];
  return castArray(a.data) as Record<string, unknown>[];
};
