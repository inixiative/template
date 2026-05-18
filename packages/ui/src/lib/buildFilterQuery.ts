import { ARRAY_FIELD_OPERATORS, type ArrayFieldOperator } from '@template/shared/bracketQuery';
import type { SearchMode } from '@template/ui/lib/makeDataConfig';
import { serializeBracketQuery } from '@template/ui/lib/serializeBracketQuery';

export type FilterState = {
  operator: ArrayFieldOperator | 'equals' | 'contains' | 'startsWith' | 'endsWith';
  values: string[];
};

const setPath = (obj: Record<string, unknown>, path: string[], value: unknown): void => {
  if (path.length === 1) {
    obj[path[0]] = value;
    return;
  }
  const [head, ...rest] = path;
  if (!obj[head] || typeof obj[head] !== 'object' || Array.isArray(obj[head])) {
    obj[head] = {};
  }
  setPath(obj[head] as Record<string, unknown>, rest, value);
};

export const buildFilterQuery = (
  search: string,
  searchMode: SearchMode,
  searchableFields: string[],
  filters: Record<string, FilterState>,
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

  for (const [field, { operator, values }] of Object.entries(filters)) {
    if (values.length > 0) {
      const filterValue = (ARRAY_FIELD_OPERATORS as readonly string[]).includes(operator)
        ? { [operator]: values }
        : { [operator]: values[0] };
      setPath(nested, field.split('.'), filterValue);
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
