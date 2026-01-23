import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WalletCreateManyInputObjectSchema as WalletCreateManyInputObjectSchema } from './objects/WalletCreateManyInput.schema';

export const WalletCreateManyAndReturnSchema: z.ZodType<Prisma.WalletCreateManyAndReturnArgs> = z.object({  data: z.union([ WalletCreateManyInputObjectSchema, z.array(WalletCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.WalletCreateManyAndReturnArgs>;

export const WalletCreateManyAndReturnZodSchema = z.object({  data: z.union([ WalletCreateManyInputObjectSchema, z.array(WalletCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();