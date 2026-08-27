/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses primitive:shared
 */
import { type ArrayFieldOperator, isCombinator, type ScalarFieldOperator } from '@template/shared/bracketQuery';
import type { SearchMode } from '@template/ui/lib/makeDataConfig';
import { serializeBracketQuery } from '@template/ui/lib/serializeBracketQuery';
import { castArray } from 'lodash-es';

export type FilterState =
  | { operator: ArrayFieldOperator; values: string[] }
  | { operator: ScalarFieldOperator; value: string };

// Prisma's where shape with FilterState leaves: a combinator key (AND/OR) carries an array of
// nested maps, one clause group per element, serialized as indexed children —
// `{ AND: [{ 'tokens.some.name': … }] }` → `searchFields[AND][0][tokens][some][name][…]`.
// Only combinator keys may carry the array-of-maps arm.
export type FilterMap = { [field: string]: FilterState | FilterState[] | FilterMap[] };

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

const addFilters = (nested: Record<string, unknown>, filters: FilterMap): void => {
  for (const [field, state] of Object.entries(filters)) {
    // An absent value is not a filter. Guards `filters.AND = groups?.map(...)` assigning undefined
    // (the natural spelling when a caller has no groups) and `setFilter(field, null)` semantics.
    if (state == null) continue;
    if (isCombinator(field)) {
      // Combinator keys carry an array of clause groups. A non-array here is a malformed map (a
      // scalar clause under AND/OR); drop it rather than crash — the server 400s the same wire.
      if (!Array.isArray(state)) continue;
      const children = (state as FilterMap[]).map((group) => {
        const child: Record<string, unknown> = {};
        addFilters(child, group);
        return child;
      });
      // A group whose clauses all carried empty values is no filter — drop it, and drop the
      // combinator entirely when no group survives (a childless combinator is a 400 server-side).
      const live = children.filter((child) => Object.keys(child).length > 0);
      if (live.length > 0) nested[field] = live;
      continue;
    }
    for (const clause of castArray(state as FilterState | FilterState[])) {
      if ('values' in clause) {
        if (clause.values.length > 0) mergePath(nested, field.split('.'), { [clause.operator]: clause.values });
      } else if (clause.value) {
        mergePath(nested, field.split('.'), { [clause.operator]: clause.value });
      }
    }
  }
};

export const buildFilterQuery = (
  search: string,
  searchMode: SearchMode,
  searchableFields: string[],
  filters: FilterMap,
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

  addFilters(nested, filters);

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
