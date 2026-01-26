import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { TokenWhereInputObjectSchema as TokenWhereInputObjectSchema } from './TokenWhereInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => TokenWhereInputObjectSchema).optional()
}).strict();
export const OrganizationCountOutputTypeCountTokensArgsObjectSchema = makeSchema();
export const OrganizationCountOutputTypeCountTokensArgsObjectZodSchema = makeSchema();
