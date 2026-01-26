import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';


const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  keyHash: z.string().optional()
}).strict();
export const TokenWhereUniqueInputObjectSchema: z.ZodType<Prisma.TokenWhereUniqueInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenWhereUniqueInput>;
export const TokenWhereUniqueInputObjectZodSchema = makeSchema();
