import * as z from 'zod';
import type { Prisma } from '../../../client/client';


const makeSchema = () => z.object({
  id: z.literal(true).optional(),
  organizationId: z.literal(true).optional(),
  userId: z.literal(true).optional(),
  role: z.literal(true).optional(),
  entitlements: z.literal(true).optional(),
  createdAt: z.literal(true).optional(),
  updatedAt: z.literal(true).optional(),
  _all: z.literal(true).optional()
}).strict();
export const OrganizationUserCountAggregateInputObjectSchema: z.ZodType<Prisma.OrganizationUserCountAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserCountAggregateInputType>;
export const OrganizationUserCountAggregateInputObjectZodSchema = makeSchema();
