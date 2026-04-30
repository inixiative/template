/**
 * Build a "broadcast" search where-clause: ORs case-insensitive
 * `contains` matches across multiple paths against a single search term.
 *
 * Paths use dot notation and follow these conventions:
 *   - 'name'              — scalar field on the model.
 *   - 'contacts.valueKey' — traverses a TO-MANY relation; emits a
 *                           `{ contacts: { some: { valueKey: ... } } }`
 *                           clause.
 *
 * Returned clause is meant to be passed to a route's
 * `query.searchFields` — `paginate()` ANDs it into the where
 * automatically. Returns `undefined` for empty/whitespace terms so
 * callers can conditionally include it.
 *
 * To-one relation traversal (`organization.name`-style) isn't supported
 * yet; intermediate segments always wrap in `some`. Add an opt-out when
 * we hit a real case for it.
 *
 * @example
 *   const searchFields = broadcastSearch(query, ['name', 'contacts.valueKey']);
 *   adminUserReadMany({ query: { page, pageSize, searchFields } });
 */
export const broadcastSearch = (
  term: string,
  paths: readonly string[],
): { OR: Record<string, unknown>[] } | undefined => {
  const trimmed = term.trim();
  if (!trimmed || paths.length === 0) return undefined;

  return { OR: paths.map((path) => buildPathClause(path, trimmed)) };
};

const buildPathClause = (path: string, term: string): Record<string, unknown> => {
  const segments = path.split('.').filter(Boolean);
  if (segments.length === 0) return {};

  // Innermost: { <leafField>: { contains: term, mode: 'insensitive' } }
  let node: Record<string, unknown> = {
    [segments[segments.length - 1]]: { contains: term, mode: 'insensitive' },
  };

  // Wrap each intermediate relation segment in a `some` (to-many).
  for (let i = segments.length - 2; i >= 0; i--) {
    node = { [segments[i]]: { some: node } };
  }
  return node;
};
