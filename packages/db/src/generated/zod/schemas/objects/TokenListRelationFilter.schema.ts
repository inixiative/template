import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { TokenWhereInputObjectSchema as TokenWhereInputObjectSchema } from './TokenWhereInput.schema'

const makeSchema = () => z.object({
  every: z.lazy(() => TokenWhereInputObjectSchema).optional(),
  some: z.lazy(() => TokenWhereInputObjectSchema).optional(),
  none: z.lazy(() => TokenWhereInputObjectSchema).optional()
}).strict();
export const TokenListRelationFilterObjectSchema: z.ZodType<Prisma.TokenListRelationFilter> = makeSchema() as unknown as z.ZodType<Prisma.TokenListRelationFilter>;
export const TokenListRelationFilterObjectZodSchema = makeSchema();
