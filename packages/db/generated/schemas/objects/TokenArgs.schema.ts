import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { TokenSelectObjectSchema as TokenSelectObjectSchema } from './TokenSelect.schema';
import { TokenIncludeObjectSchema as TokenIncludeObjectSchema } from './TokenInclude.schema'

const makeSchema = () => z.object({
  select: z.lazy(() => TokenSelectObjectSchema).optional(),
  include: z.lazy(() => TokenIncludeObjectSchema).optional()
}).strict();
export const TokenArgsObjectSchema = makeSchema();
export const TokenArgsObjectZodSchema = makeSchema();
