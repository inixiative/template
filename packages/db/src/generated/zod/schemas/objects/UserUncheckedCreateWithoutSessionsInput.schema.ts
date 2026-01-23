import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { KycStatusSchema } from '../enums/KycStatus.schema';
import { WalletUncheckedCreateNestedManyWithoutUserInputObjectSchema as WalletUncheckedCreateNestedManyWithoutUserInputObjectSchema } from './WalletUncheckedCreateNestedManyWithoutUserInput.schema'

const makeSchema = () => z.object({
  id: z.string().optional(),
  email: z.string(),
  emailVerified: z.boolean().optional(),
  passwordHash: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  kycStatus: KycStatusSchema.optional(),
  kycProvider: z.string().optional().nullable(),
  kycExternalId: z.string().optional().nullable(),
  kycVerifiedAt: z.coerce.date().optional().nullable(),
  region: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  wallets: z.lazy(() => WalletUncheckedCreateNestedManyWithoutUserInputObjectSchema).optional()
}).strict();
export const UserUncheckedCreateWithoutSessionsInputObjectSchema: z.ZodType<Prisma.UserUncheckedCreateWithoutSessionsInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUncheckedCreateWithoutSessionsInput>;
export const UserUncheckedCreateWithoutSessionsInputObjectZodSchema = makeSchema();
