import * as z from 'zod';
import type { Prisma } from '../../../client/client';


const makeSchema = () => z.object({
  id: z.literal(true).optional(),
  createdAt: z.literal(true).optional(),
  updatedAt: z.literal(true).optional(),
  deletedAt: z.literal(true).optional(),
  name: z.literal(true).optional(),
  slug: z.literal(true).optional()
}).strict();
export const OrganizationMinAggregateInputObjectSchema: z.ZodType<Prisma.OrganizationMinAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationMinAggregateInputType>;
export const OrganizationMinAggregateInputObjectZodSchema = makeSchema();
