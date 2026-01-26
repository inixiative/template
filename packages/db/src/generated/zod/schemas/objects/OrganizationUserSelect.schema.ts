import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationArgsObjectSchema as OrganizationArgsObjectSchema } from './OrganizationArgs.schema';
import { UserArgsObjectSchema as UserArgsObjectSchema } from './UserArgs.schema';
import { TokenFindManySchema as TokenFindManySchema } from '../findManyToken.schema';
import { OrganizationUserCountOutputTypeArgsObjectSchema as OrganizationUserCountOutputTypeArgsObjectSchema } from './OrganizationUserCountOutputTypeArgs.schema'

const makeSchema = () => z.object({
  id: z.boolean().optional(),
  organizationId: z.boolean().optional(),
  userId: z.boolean().optional(),
  role: z.boolean().optional(),
  entitlements: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  organization: z.union([z.boolean(), z.lazy(() => OrganizationArgsObjectSchema)]).optional(),
  user: z.union([z.boolean(), z.lazy(() => UserArgsObjectSchema)]).optional(),
  tokens: z.union([z.boolean(), z.lazy(() => TokenFindManySchema)]).optional(),
  _count: z.union([z.boolean(), z.lazy(() => OrganizationUserCountOutputTypeArgsObjectSchema)]).optional()
}).strict();
export const OrganizationUserSelectObjectSchema: z.ZodType<Prisma.OrganizationUserSelect> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserSelect>;
export const OrganizationUserSelectObjectZodSchema = makeSchema();
