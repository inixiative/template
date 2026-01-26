import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';


const makeSchema = () => z.object({
  id: z.literal(true).optional(),
  organizationId: z.literal(true).optional(),
  userId: z.literal(true).optional(),
  role: z.literal(true).optional(),
  createdAt: z.literal(true).optional(),
  updatedAt: z.literal(true).optional()
}).strict();
export const OrganizationUserMinAggregateInputObjectSchema: z.ZodType<Prisma.OrganizationUserMinAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserMinAggregateInputType>;
export const OrganizationUserMinAggregateInputObjectZodSchema = makeSchema();
