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
 * `model` filters paths to String-typed leaves only — `contains` is
 * meaningless on enums, dates, ints, booleans, etc., and the server
 * rejects it. Callers pass the model their pages render against (e.g.
 * `'User'` for `UsersPage`); paths that resolve to non-String fields
 * are silently dropped before the OR is built. If no paths survive,
 * returns `undefined`.
 *
 * To-one relation traversal (`organization.name`-style) isn't supported
 * yet; intermediate segments always wrap in `some`. Add an opt-out when
 * we hit a real case for it.
 *
 * @example
 *   const searchFields = broadcastSearch(query, ['name', 'contacts.valueKey'], { model: 'User' });
 *   adminUserReadMany({ query: { page, pageSize, searchFields } });
 */

import type { ModelName } from '@template/db';
import { isStringPath } from '@template/ui/lib/broadcastSearchFieldKind';

type Options = {
  /**
   * The Prisma model paths are rooted at. When passed, paths are filtered
   * to String-typed leaves only (silent drop of enum/date/int/boolean/etc.
   * paths). When omitted, every path is included as-is — meant for tests /
   * one-off prototype callers, not real pages.
   */
  model?: ModelName;
};

export const broadcastSearch = (
  term: string,
  paths: readonly string[],
  options: Options = {},
): { OR: Record<string, unknown>[] } | undefined => {
  const trimmed = term.trim();
  if (!trimmed || paths.length === 0) return undefined;

  const eligible = options.model ? paths.filter((p) => isStringPath(options.model as string, p)) : paths;
  if (eligible.length === 0) return undefined;

  return { OR: eligible.map((path) => buildPathClause(path, trimmed)) };
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
