import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFilterObjectSchema as StringFilterObjectSchema } from './StringFilter.schema';
import { EnumChainFilterObjectSchema as EnumChainFilterObjectSchema } from './EnumChainFilter.schema';
import { ChainSchema } from '../enums/Chain.schema';
import { BoolFilterObjectSchema as BoolFilterObjectSchema } from './BoolFilter.schema';
import { DateTimeNullableFilterObjectSchema as DateTimeNullableFilterObjectSchema } from './DateTimeNullableFilter.schema';
import { DateTimeFilterObjectSchema as DateTimeFilterObjectSchema } from './DateTimeFilter.schema'

const walletscalarwhereinputSchema = z.object({
  AND: z.union([z.lazy(() => WalletScalarWhereInputObjectSchema), z.lazy(() => WalletScalarWhereInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => WalletScalarWhereInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => WalletScalarWhereInputObjectSchema), z.lazy(() => WalletScalarWhereInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  userId: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  address: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  chain: z.union([z.lazy(() => EnumChainFilterObjectSchema), ChainSchema]).optional(),
  isPrimary: z.union([z.lazy(() => BoolFilterObjectSchema), z.boolean()]).optional(),
  isPayoutWallet: z.union([z.lazy(() => BoolFilterObjectSchema), z.boolean()]).optional(),
  verifiedAt: z.union([z.lazy(() => DateTimeNullableFilterObjectSchema), z.coerce.date()]).optional().nullable(),
  createdAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional()
}).strict();
export const WalletScalarWhereInputObjectSchema: z.ZodType<Prisma.WalletScalarWhereInput> = walletscalarwhereinputSchema as unknown as z.ZodType<Prisma.WalletScalarWhereInput>;
export const WalletScalarWhereInputObjectZodSchema = walletscalarwhereinputSchema;
