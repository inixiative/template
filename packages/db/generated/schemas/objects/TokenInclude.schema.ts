import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserArgsObjectSchema as UserArgsObjectSchema } from './UserArgs.schema';
import { OrganizationArgsObjectSchema as OrganizationArgsObjectSchema } from './OrganizationArgs.schema';
import { OrganizationUserArgsObjectSchema as OrganizationUserArgsObjectSchema } from './OrganizationUserArgs.schema'

const makeSchema = () => z.object({
  user: z.union([z.boolean(), z.lazy(() => UserArgsObjectSchema)]).optional(),
  organization: z.union([z.boolean(), z.lazy(() => OrganizationArgsObjectSchema)]).optional(),
  organizationUser: z.union([z.boolean(), z.lazy(() => OrganizationUserArgsObjectSchema)]).optional()
}).strict();
export const TokenIncludeObjectSchema: z.ZodType<Prisma.TokenInclude> = makeSchema() as unknown as z.ZodType<Prisma.TokenInclude>;
export const TokenIncludeObjectZodSchema = makeSchema();
