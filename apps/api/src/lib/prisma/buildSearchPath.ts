/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses none
 */
import { lookupField } from '#/lib/prisma/fieldMetadata';

// Cardinality-aware `buildNestedPath` for global search: to-many hops wrap in
// `some`; each relation hop ANDs in its visit's row-scope inside the same boundary.
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
