/**
 * @atlas
 * @partOf primitive:routeTemplates
 */
import { z } from '@hono/zod-openapi';
import { type FieldMapEntry, type LensNarrowing, projectByPath } from '@inixiative/json-rules';
import { redactLens } from '@template/db/lens/redactLens';
import { leafFilterSchema } from '#/lib/routeTemplates/filters/filterComponents';

type Visit = { fields: Record<string, FieldMapEntry> };

const buildNodeShape = (byPath: Map<string, Visit>, nodePath: string): Record<string, z.ZodTypeAny> => {
  const shape: Record<string, z.ZodTypeAny> = {};
  const visit = byPath.get(nodePath);
  if (!visit) return shape;

  for (const [field, entry] of Object.entries(visit.fields)) {
    if (entry.kind === 'object') {
      const childShape = buildNodeShape(byPath, `${nodePath}.${field}`);
      if (Object.keys(childShape).length === 0) continue;
      const child = z.object(childShape).strict();
      // to-many → Prisma relation operators; to-one → nest directly.
      shape[field] = (
        entry.isList
          ? z.object({ some: child.optional(), every: child.optional(), none: child.optional() }).strict()
          : child
      ).optional();
      continue;
    }
    const leaf = leafFilterSchema(entry);
    if (leaf) shape[field] = leaf.optional();
  }

  return shape;
};

// Typed, Prisma-`where`-shaped filter schema for a route's filterLens: a nested tree
// of per-kind filter leaves (to-one nested directly, to-many under some/every/none),
// scoped to the lens's redacted+narrowed searchable fields.
export const buildSearchFieldsSchema = (filterLens: LensNarrowing): z.ZodTypeAny | undefined => {
  const byPath = projectByPath(redactLens(filterLens)) as Map<string, Visit>;
  const rootKey = byPath.keys().next().value;
  if (!rootKey) return undefined;
  const shape = buildNodeShape(byPath, rootKey);
  if (Object.keys(shape).length === 0) return undefined;
  return z
    .object(shape)
    .strict()
    .optional()
    .openapi({ param: { in: 'query' } });
};
