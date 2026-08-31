/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses primitive:shared
 */
import { type ArrayFieldOperator, isCombinator, type ScalarFieldOperator } from '@template/shared/bracketQuery';
import type { SearchMode } from '@template/ui/lib/makeDataConfig';
import { serializeBracketQuery } from '@template/ui/lib/serializeBracketQuery';

export type FilterState =
  | { operator: ArrayFieldOperator; values: string[] }
  | { operator: ScalarFieldOperator; value: string };

// Prisma's where shape with FilterState leaves: a combinator key (AND/OR) carries an array of
// nested maps, one clause group per element, serialized as indexed children —
// `{ AND: [{ 'tokens.some.name': … }] }` → `searchFields[AND][0][tokens][some][name][…]`.
// Only a combinator key may carry that array-of-maps arm; every other key is a dot-path to a leaf.
export type FilterMap = { [field: string]: FilterState | FilterState[] | FilterMap[] };

// A clause group is a plain object. null, an array, or a scalar names no group.
const isFilterMap = (value: unknown): value is FilterMap =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// A leaf clause needs both halves the right shape, not just present: an operator, plus the value
// arm its operator kind expects (array ops carry `values`, scalar ops carry `value`). A bare-string
// `values` is the trap — it has a `.length`, so it clears the empty check, and the operator then
// serializes the raw string as the filter: a wrong query that looks like a working one.
const isFilterState = (value: unknown): value is FilterState =>
  isFilterMap(value) &&
  typeof (value as { operator?: unknown }).operator === 'string' &&
  (Array.isArray((value as { values?: unknown }).values) || typeof (value as { value?: unknown }).value === 'string');

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
      const children = (state as unknown[]).flatMap((group) => {
        if (!isFilterMap(group)) return [];
        const child: Record<string, unknown> = {};
        addFilters(child, group);
        return [child];
      });
      // A group whose clauses all carried empty values is no filter — drop it, and drop the
      // combinator entirely when no group survives (a childless combinator is a 400 server-side).
      const live = children.filter((child) => Object.keys(child).length > 0);
      if (live.length > 0) nested[field] = live;
      continue;
    }
    // A field may carry several operator clauses (e.g. gte + lte for a range); each is folded in.
    const clauses: unknown[] = Array.isArray(state) ? state : [state];
    for (const clause of clauses) {
      if (!isFilterState(clause)) continue;
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
