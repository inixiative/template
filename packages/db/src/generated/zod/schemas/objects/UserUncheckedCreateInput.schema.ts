import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { KycStatusSchema } from '../enums/KycStatus.schema';
import { SessionUncheckedCreateNestedManyWithoutUserInputObjectSchema as SessionUncheckedCreateNestedManyWithoutUserInputObjectSchema } from './SessionUncheckedCreateNestedManyWithoutUserInput.schema';
import { WalletUncheckedCreateNestedManyWithoutUserInputObjectSchema as WalletUncheckedCreateNestedManyWithoutUserInputObjectSchema } from './WalletUncheckedCreateNestedManyWithoutUserInput.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  email: z.string().max(255),
  emailVerified: z.boolean().optional(),
  passwordHash: z.string().max(255).optional().nullable(),
  name: z.string().max(255).optional().nullable(),
  avatarUrl: z.string().max(512).optional().nullable(),
  kycStatus: KycStatusSchema.optional(),
  kycProvider: z.string().max(50).optional().nullable(),
  kycExternalId: z.string().max(255).optional().nullable(),
  kycVerifiedAt: z.coerce.date().optional().nullable(),
  region: z.string().max(10).optional().nullable(),
  createdAt: z.coerce.date().optional(),
  sessions: z.lazy(() => SessionUncheckedCreateNestedManyWithoutUserInputObjectSchema).optional(),
  wallets: z.lazy(() => WalletUncheckedCreateNestedManyWithoutUserInputObjectSchema).optional()
}).strict();
export const UserUncheckedCreateInputObjectSchema: z.ZodType<Prisma.UserUncheckedCreateInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUncheckedCreateInput>;
export const UserUncheckedCreateInputObjectZodSchema = makeSchema();
