import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserArgsObjectSchema as UserArgsObjectSchema } from './UserArgs.schema';
import { OrganizationArgsObjectSchema as OrganizationArgsObjectSchema } from './OrganizationArgs.schema';
import { OrganizationUserArgsObjectSchema as OrganizationUserArgsObjectSchema } from './OrganizationUserArgs.schema'

const makeSchema = () => z.object({
  id: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  name: z.boolean().optional(),
  keyHash: z.boolean().optional(),
  keyPrefix: z.boolean().optional(),
  ownerModel: z.boolean().optional(),
  userId: z.boolean().optional(),
  organizationId: z.boolean().optional(),
  user: z.union([z.boolean(), z.lazy(() => UserArgsObjectSchema)]).optional(),
  organization: z.union([z.boolean(), z.lazy(() => OrganizationArgsObjectSchema)]).optional(),
  organizationUser: z.union([z.boolean(), z.lazy(() => OrganizationUserArgsObjectSchema)]).optional(),
  role: z.boolean().optional(),
  entitlements: z.boolean().optional(),
  expiresAt: z.boolean().optional(),
  lastUsedAt: z.boolean().optional(),
  isActive: z.boolean().optional()
}).strict();
export const TokenSelectObjectSchema: z.ZodType<Prisma.TokenSelect> = makeSchema() as unknown as z.ZodType<Prisma.TokenSelect>;
export const TokenSelectObjectZodSchema = makeSchema();
