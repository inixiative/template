import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { KycStatusSchema } from '../enums/KycStatus.schema';
import { WalletCreateNestedManyWithoutUserInputObjectSchema as WalletCreateNestedManyWithoutUserInputObjectSchema } from './WalletCreateNestedManyWithoutUserInput.schema'

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
  updatedAt: z.coerce.date().optional(),
  wallets: z.lazy(() => WalletCreateNestedManyWithoutUserInputObjectSchema).optional()
}).strict();
export const UserCreateWithoutSessionsInputObjectSchema: z.ZodType<Prisma.UserCreateWithoutSessionsInput> = makeSchema() as unknown as z.ZodType<Prisma.UserCreateWithoutSessionsInput>;
export const UserCreateWithoutSessionsInputObjectZodSchema = makeSchema();
