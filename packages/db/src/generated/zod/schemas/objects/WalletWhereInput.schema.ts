import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFilterObjectSchema as StringFilterObjectSchema } from './StringFilter.schema';
import { EnumChainFilterObjectSchema as EnumChainFilterObjectSchema } from './EnumChainFilter.schema';
import { ChainSchema } from '../enums/Chain.schema';
import { BoolFilterObjectSchema as BoolFilterObjectSchema } from './BoolFilter.schema';
import { DateTimeNullableFilterObjectSchema as DateTimeNullableFilterObjectSchema } from './DateTimeNullableFilter.schema';
import { DateTimeFilterObjectSchema as DateTimeFilterObjectSchema } from './DateTimeFilter.schema';
import { UserScalarRelationFilterObjectSchema as UserScalarRelationFilterObjectSchema } from './UserScalarRelationFilter.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema'

const walletwhereinputSchema = z.object({
  AND: z.union([z.lazy(() => WalletWhereInputObjectSchema), z.lazy(() => WalletWhereInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => WalletWhereInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => WalletWhereInputObjectSchema), z.lazy(() => WalletWhereInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringFilterObjectSchema), z.string().max(36)]).optional(),
  userId: z.union([z.lazy(() => StringFilterObjectSchema), z.string().max(36)]).optional(),
  address: z.union([z.lazy(() => StringFilterObjectSchema), z.string().max(42)]).optional(),
  chain: z.union([z.lazy(() => EnumChainFilterObjectSchema), ChainSchema]).optional(),
  isPrimary: z.union([z.lazy(() => BoolFilterObjectSchema), z.boolean()]).optional(),
  isPayoutWallet: z.union([z.lazy(() => BoolFilterObjectSchema), z.boolean()]).optional(),
  verifiedAt: z.union([z.lazy(() => DateTimeNullableFilterObjectSchema), z.coerce.date()]).optional().nullable(),
  createdAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  user: z.union([z.lazy(() => UserScalarRelationFilterObjectSchema), z.lazy(() => UserWhereInputObjectSchema)]).optional()
}).strict();
export const WalletWhereInputObjectSchema: z.ZodType<Prisma.WalletWhereInput> = walletwhereinputSchema as unknown as z.ZodType<Prisma.WalletWhereInput>;
export const WalletWhereInputObjectZodSchema = walletwhereinputSchema;
