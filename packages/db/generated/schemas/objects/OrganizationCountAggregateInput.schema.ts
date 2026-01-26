import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';


const makeSchema = () => z.object({
  id: z.literal(true).optional(),
  createdAt: z.literal(true).optional(),
  updatedAt: z.literal(true).optional(),
  deletedAt: z.literal(true).optional(),
  name: z.literal(true).optional(),
  slug: z.literal(true).optional(),
  _all: z.literal(true).optional()
}).strict();
export const OrganizationCountAggregateInputObjectSchema: z.ZodType<Prisma.OrganizationCountAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationCountAggregateInputType>;
export const OrganizationCountAggregateInputObjectZodSchema = makeSchema();
