/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses primitive:shared
 */
import {
  type ArrayFieldOperator,
  isArrayFieldOperator,
  isCombinator,
  type ScalarFieldOperator,
} from '@template/shared/bracketQuery';
import { serializeBracketQuery } from '@template/ui/lib/serializeBracketQuery';

// Values carry their real type end to end: serializeBracketQuery marks null/boolean with `[:]`
// and finite numbers with `[$]`, and the server parses both back to the real type — so `null` is
// a filter (match IS NULL), not the string "null". Absence of a filter is `undefined`.
export type FilterValue = string | number | boolean | null;

// One `value` field, mirroring the json-rules engine's `Rule` (the source of truth for this
// shape): an array for the array operators (`in`/`notIn`), a scalar otherwise. Reads like the
// rule it becomes — `{ operator: 'equals', value: 'gold' }`, `{ operator: 'in', value: [...] }`.
export type FilterState =
  | { operator: ArrayFieldOperator; value: FilterValue[] }
  | { operator: ScalarFieldOperator; value: FilterValue };

// Prisma's where shape with FilterState leaves: a combinator key (AND/OR) carries an array of
// nested maps, one clause group per element, serialized as indexed children —
// `{ AND: [{ 'tokens.some.name': … }] }` → `searchFields[AND][0][tokens][some][name][…]`.
// Only a combinator key may carry that array-of-maps arm; every other key is a dot-path to a leaf.
export type FilterMap = { [field: string]: FilterState | FilterState[] | FilterMap[] };

// A clause group is a plain object. null, an array, or a scalar names no group.
const isFilterMap = (value: unknown): value is FilterMap =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// A concrete filter value. `null` counts (match IS NULL); `undefined` does not (no filter).
const isFilterValue = (value: unknown): value is FilterValue =>
  value === null || ['string', 'number', 'boolean'].includes(typeof value);

// A leaf clause is an operator plus a `value` shaped to match it: an array for `in`/`notIn`, a
// scalar for everything else — the same value/operator pairing json-rules' `Rule` enforces. A
// missing value (`undefined`), a scalar under `in`, or an array under a scalar op all fail here,
// which is how absence-of-filter and mismatched shapes drop out. `null`/`false`/`0` pass — they
// are real filters.
const isFilterState = (value: unknown): value is FilterState => {
  if (!isFilterMap(value)) return false;
  const { operator, value: leaf } = value as { operator?: unknown; value?: unknown };
  if (typeof operator !== 'string') return false;
  return isArrayFieldOperator(operator) ? Array.isArray(leaf) : isFilterValue(leaf);
};

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
    for (const raw of clauses) {
      if (!isFilterState(raw)) continue;
      const clause = raw as { operator: string; value: FilterValue | FilterValue[] };
      // isFilterState already rejected an undefined value, so a present value emits even when it
      // is `null`/`false`/`0` — those are filters, and the serializer's `[:]`/`[$]` markers carry
      // them. An empty array (`in: []`) is the one "no filter" case that still gates.
      if (Array.isArray(clause.value)) {
        if (clause.value.length > 0) mergePath(nested, field.split('.'), { [clause.operator]: clause.value });
      } else {
        mergePath(nested, field.split('.'), { [clause.operator]: clause.value });
      }
    }
  }
};

export const buildFilterQuery = (
  search: string,
  searchableFields: string[],
  filters: FilterMap,
  orderBy: Array<{ field: string; direction: 'asc' | 'desc' }>,
): Record<string, unknown> => {
  const query: Record<string, unknown> = {};

  // Free-text search is server-side: the API's `search` param fans the term out across every
  // searchable field with OR(contains), token by token. The FE just forwards the raw string.
  if (search && searchableFields.length > 0) {
    query.search = search;
  }

  const nested: Record<string, unknown> = {};

  addFilters(nested, filters);

  if (Object.keys(nested).length > 0) {
    const params = serializeBracketQuery({ searchFields: nested });
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
