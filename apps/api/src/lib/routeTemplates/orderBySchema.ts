/**
 * @atlas
 * @kind schema
 * @partOf primitive:routeTemplates
 * @uses infrastructure:prisma
 */
import { z } from '@hono/zod-openapi';
import { Prisma } from '@template/db';
import { castArray } from 'lodash-es';
import { buildNestedPath } from '#/lib/prisma/pathNotation';

const orderByItemSchema = z.string().regex(/^[\w.]+:(asc|desc)$/i);

export const orderByRequestSchema = z
  .union([z.array(orderByItemSchema), orderByItemSchema])
  .transform((val) => castArray(val))
  .optional()
  .openapi({
    param: { in: 'query' },
    example: ['name:asc', 'user.email:desc', 'createdAt:desc'],
  });

// orderBy arrives validated by the lens-derived enum (buildOrderBySchema), so
// this is a pure transform from `field:dir` into Prisma's nested orderBy shape.
export const parseOrderBy = (orderBy: string[]): Record<string, unknown>[] =>
  orderBy.map((item) => {
    const [field, direction] = item.split(':');
    return buildNestedPath(field, direction.toLowerCase() === 'asc' ? Prisma.SortOrder.asc : Prisma.SortOrder.desc);
  });
