import * as z from 'zod';
import type { Prisma } from '../../../client/client';


const makeSchema = () => z.object({
  id: z.literal(true).optional(),
  identifier: z.literal(true).optional(),
  value: z.literal(true).optional(),
  expiresAt: z.literal(true).optional(),
  createdAt: z.literal(true).optional(),
  updatedAt: z.literal(true).optional()
}).strict();
export const VerificationMaxAggregateInputObjectSchema: z.ZodType<Prisma.VerificationMaxAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.VerificationMaxAggregateInputType>;
export const VerificationMaxAggregateInputObjectZodSchema = makeSchema();
