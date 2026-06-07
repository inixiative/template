import { z } from '@hono/zod-openapi';
import type { LensNarrowing } from '@inixiative/json-rules';
import { orderablePaths } from '@template/db/lens';

// orderBy scoped to the lens's orderable fields: an enum of `<field>:asc|desc`
// (single or array). orderablePaths already excludes to-many + Json/Bytes.
export const buildOrderBySchema = (filterLens: LensNarrowing) => {
  const paths = orderablePaths(filterLens);
  if (!paths.length) return undefined;

  const values = paths.flatMap((path) => [`${path}:asc`, `${path}:desc`]) as [string, ...string[]];
  const item = z.enum(values);
  return z
    .union([z.array(item), item])
    .optional()
    .openapi({ param: { in: 'query' }, example: [values[0]] });
};
