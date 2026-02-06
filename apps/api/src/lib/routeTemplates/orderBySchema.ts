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

export const parseOrderBy = (orderBy: string[]): Record<string, Prisma.SortOrder>[] => {
  return orderBy.map((item) => {
    const [field, direction] = item.split(':');

    if (!validatePathNotation(field)) {
      throw new Error(`Invalid orderBy path: ${field}`);
    }

    const sortOrder = direction.toLowerCase() === 'asc'
      ? Prisma.SortOrder.asc
      : Prisma.SortOrder.desc;

    return buildNestedPath(field, sortOrder);
  });
};
