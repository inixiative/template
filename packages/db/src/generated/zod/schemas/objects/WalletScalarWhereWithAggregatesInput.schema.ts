import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringWithAggregatesFilterObjectSchema as StringWithAggregatesFilterObjectSchema } from './StringWithAggregatesFilter.schema';
import { EnumChainWithAggregatesFilterObjectSchema as EnumChainWithAggregatesFilterObjectSchema } from './EnumChainWithAggregatesFilter.schema';
import { ChainSchema } from '../enums/Chain.schema';
import { BoolWithAggregatesFilterObjectSchema as BoolWithAggregatesFilterObjectSchema } from './BoolWithAggregatesFilter.schema';
import { DateTimeNullableWithAggregatesFilterObjectSchema as DateTimeNullableWithAggregatesFilterObjectSchema } from './DateTimeNullableWithAggregatesFilter.schema';
import { DateTimeWithAggregatesFilterObjectSchema as DateTimeWithAggregatesFilterObjectSchema } from './DateTimeWithAggregatesFilter.schema'

const walletscalarwherewithaggregatesinputSchema = z.object({
  AND: z.union([z.lazy(() => WalletScalarWhereWithAggregatesInputObjectSchema), z.lazy(() => WalletScalarWhereWithAggregatesInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => WalletScalarWhereWithAggregatesInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => WalletScalarWhereWithAggregatesInputObjectSchema), z.lazy(() => WalletScalarWhereWithAggregatesInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(36)]).optional(),
  userId: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(36)]).optional(),
  address: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(42)]).optional(),
  chain: z.union([z.lazy(() => EnumChainWithAggregatesFilterObjectSchema), ChainSchema]).optional(),
  isPrimary: z.union([z.lazy(() => BoolWithAggregatesFilterObjectSchema), z.boolean()]).optional(),
  isPayoutWallet: z.union([z.lazy(() => BoolWithAggregatesFilterObjectSchema), z.boolean()]).optional(),
  verifiedAt: z.union([z.lazy(() => DateTimeNullableWithAggregatesFilterObjectSchema), z.coerce.date()]).optional().nullable(),
  createdAt: z.union([z.lazy(() => DateTimeWithAggregatesFilterObjectSchema), z.coerce.date()]).optional()
}).strict();
export const WalletScalarWhereWithAggregatesInputObjectSchema: z.ZodType<Prisma.WalletScalarWhereWithAggregatesInput> = walletscalarwherewithaggregatesinputSchema as unknown as z.ZodType<Prisma.WalletScalarWhereWithAggregatesInput>;
export const WalletScalarWhereWithAggregatesInputObjectZodSchema = walletscalarwherewithaggregatesinputSchema;
