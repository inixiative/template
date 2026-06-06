import type { ArrayFieldOperator, ScalarFieldOperator } from '@template/shared/bracketQuery';
import type { SearchMode } from '@template/ui/lib/makeDataConfig';
import { serializeBracketQuery } from '@template/ui/lib/serializeBracketQuery';
import { castArray } from 'lodash-es';

export type FilterState =
  | { operator: ArrayFieldOperator; values: string[] }
  | { operator: ScalarFieldOperator; value: string };

const mergePath = (obj: Record<string, unknown>, path: string[], value: Record<string, unknown>): void => {
  const [head, ...rest] = path;
  if (!obj[head] || typeof obj[head] !== 'object' || Array.isArray(obj[head])) {
    obj[head] = {};
  }
  const next = obj[head] as Record<string, unknown>;
  if (rest.length === 0) {
    Object.assign(next, value);
    return;
  }
  mergePath(next, rest, value);
};

export const buildFilterQuery = (
  search: string,
  searchMode: SearchMode,
  searchableFields: string[],
  filters: Record<string, FilterState | FilterState[]>,
  orderBy: Array<{ field: string; direction: 'asc' | 'desc' }>,
  adminMode = false,
): Record<string, unknown> => {
  const query: Record<string, unknown> = {};

  if (search && searchMode === 'combined' && !adminMode && searchableFields.length > 0) {
    query.search = search;
  }

  const nested: Record<string, unknown> = {};

  if (search && searchMode === 'field') {
    for (const field of searchableFields) {
      nested[field] = { contains: search };
    }
  }

  for (const [field, state] of Object.entries(filters)) {
    for (const clause of castArray(state)) {
      if ('values' in clause) {
        if (clause.values.length > 0) mergePath(nested, field.split('.'), { [clause.operator]: clause.values });
      } else if (clause.value) {
        mergePath(nested, field.split('.'), { [clause.operator]: clause.value });
      }
    }
  }

  const bracketPrefix = adminMode ? 'filters' : 'searchFields';

  if (Object.keys(nested).length > 0) {
    const params = serializeBracketQuery({ [bracketPrefix]: nested });
    for (const key of new Set(params.keys())) {
      const allValues = params.getAll(key);
      query[key] = allValues.length === 1 ? allValues[0] : allValues;
    }
  }

  if (orderBy.length > 0) {
    query.orderBy = orderBy.map(({ field, direction }) => `${field}:${direction}`);
  }

  return query;
};
