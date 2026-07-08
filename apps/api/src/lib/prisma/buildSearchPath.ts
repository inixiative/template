/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses none
 */
import { lookupField } from '#/lib/prisma/fieldMetadata';

// Cardinality-aware companion to `buildNestedPath` for the global-search walk:
// a to-one hop nests directly, a to-many hop wraps in `some` (from the field's
// `isList`). Each relation hop folds in `visitWhere(visitKey)` — the lens's
// composed row-scope for that visit — ANDed with the inner clause inside the
// same boundary, so scope and match apply to the same related row.
// The path must resolve on `model`; callers validate via `lookupField` first.
export const buildSearchPath = (
  model: string,
  path: string,
  clause: Record<string, unknown>,
  visitWhere: (visitKey: string) => Record<string, unknown>[],
  visitKey = model,
): Record<string, unknown> => {
  const [seg = '', ...rest] = path.split('.');
  if (!rest.length) return { [seg]: clause };

  const field = lookupField(model, seg)!;
  const childKey = `${visitKey}.${seg}`;
  const inner = buildSearchPath(field.type, rest.join('.'), clause, visitWhere, childKey);
  const wheres = visitWhere(childKey);
  const scoped = wheres.length ? { AND: [inner, ...wheres] } : inner;
  return { [seg]: field.kind === 'object' && field.isList ? { some: scoped } : scoped };
};
