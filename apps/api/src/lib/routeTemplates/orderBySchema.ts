import { z } from '@hono/zod-openapi';
import { Prisma } from '@template/db';
import { buildNestedPath, validatePathNotation } from '#/lib/prisma/pathNotation';

const orderByItemSchema = z.string().regex(/^[\w.]+:(asc|desc)$/i);

export const orderByRequestSchema = z
  .union([z.array(orderByItemSchema), orderByItemSchema])
  .transform((val) => (Array.isArray(val) ? val : [val]))
  .optional()
  .openapi({
    param: { in: 'query' },
    example: ['name:asc', 'user.email:desc', 'createdAt:desc'],
  });

// `orderableFields` is the per-route allowlist (mirrors searchableFields).
// When supplied, a field outside it throws — without it, an unsortable field
// would reach Prisma raw. Omit it to keep path-notation-only validation
// (superadmin-gated callers that haven't opted into an allowlist).
export const parseOrderBy = (orderBy: string[], orderableFields?: readonly string[]): Record<string, unknown>[] => {
  return orderBy.map((item) => {
    const [field, direction] = item.split(':');

    if (!validatePathNotation(field)) {
      throw new Error(`Invalid orderBy path: ${field}`);
    }

    if (orderableFields && !orderableFields.includes(field)) {
      throw new Error(`Field '${field}' is not orderable. Allowed fields: ${orderableFields.join(', ')}`);
    }

    const sortOrder = direction.toLowerCase() === 'asc' ? Prisma.SortOrder.asc : Prisma.SortOrder.desc;

    return buildNestedPath(field, sortOrder);
  });
};
