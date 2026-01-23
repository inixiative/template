import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WalletCreateManyInputObjectSchema as WalletCreateManyInputObjectSchema } from './objects/WalletCreateManyInput.schema';

export const WalletCreateManySchema: z.ZodType<Prisma.WalletCreateManyArgs> = z.object({ data: z.union([ WalletCreateManyInputObjectSchema, z.array(WalletCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.WalletCreateManyArgs>;

export const WalletCreateManyZodSchema = z.object({ data: z.union([ WalletCreateManyInputObjectSchema, z.array(WalletCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();