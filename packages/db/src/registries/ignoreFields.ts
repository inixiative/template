import { omit } from 'lodash-es';

/**
 * Fields to ignore when determining if a mutation is meaningful.
 * Used by: Cache, Webhooks, Audit logs.
 */
export const HOOK_IGNORE_FIELDS: Record<string, string[]> = {
  _global: ['updatedAt'],
  User: ['lastLoginAt'],
  Token: ['lastUsedAt'],
};

export const getIgnoreFields = (model: string): string[] => [
  ...(HOOK_IGNORE_FIELDS._global ?? []),
  ...(HOOK_IGNORE_FIELDS[model] ?? []),
];

export const filterIgnoredFields = <T extends Record<string, unknown>>(model: string, data: T): Partial<T> =>
  omit(data, getIgnoreFields(model)) as Partial<T>;
