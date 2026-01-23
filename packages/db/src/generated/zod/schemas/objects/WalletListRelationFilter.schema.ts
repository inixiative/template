import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WalletWhereInputObjectSchema as WalletWhereInputObjectSchema } from './WalletWhereInput.schema'

const makeSchema = () => z.object({
  every: z.lazy(() => WalletWhereInputObjectSchema).optional(),
  some: z.lazy(() => WalletWhereInputObjectSchema).optional(),
  none: z.lazy(() => WalletWhereInputObjectSchema).optional()
}).strict();
export const WalletListRelationFilterObjectSchema: z.ZodType<Prisma.WalletListRelationFilter> = makeSchema() as unknown as z.ZodType<Prisma.WalletListRelationFilter>;
export const WalletListRelationFilterObjectZodSchema = makeSchema();
