/**
 * @atlas
 * @kind helper
 * @partOf primitive:routeTemplates
 * @uses infrastructure:prisma
 */
import { z } from '@hono/zod-openapi';
import type { LensNarrowing } from '@inixiative/json-rules';
import { orderablePaths } from '@template/db/lens';
import { toArray } from '@template/shared/utils';

// orderBy scoped to the lens's orderable fields: an enum of `<field>:asc|desc`
// (single or array). orderablePaths already excludes to-many + Json/Bytes.
// toArray normalizes a single value → array so the runtime always receives a
// list (matches orderByRequestSchema; parseOrderBy maps over it).
export const buildOrderBySchema = (filterLens: LensNarrowing) => {
  const paths = orderablePaths(filterLens);
  if (!paths.length) return undefined;

  const values = paths.flatMap((path) => [`${path}:asc`, `${path}:desc`]) as [string, ...string[]];
  const item = z.enum(values);
  return z
    .union([z.array(item), item])
    .transform((val) => toArray(val))
    .optional()
    .openapi({ param: { in: 'query' }, example: [values[0]] });
};
