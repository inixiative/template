import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationArgsObjectSchema as OrganizationArgsObjectSchema } from './OrganizationArgs.schema';
import { UserArgsObjectSchema as UserArgsObjectSchema } from './UserArgs.schema';
import { TokenFindManySchema as TokenFindManySchema } from '../findManyToken.schema';
import { OrganizationUserCountOutputTypeArgsObjectSchema as OrganizationUserCountOutputTypeArgsObjectSchema } from './OrganizationUserCountOutputTypeArgs.schema'

const makeSchema = () => z.object({
  organization: z.union([z.boolean(), z.lazy(() => OrganizationArgsObjectSchema)]).optional(),
  user: z.union([z.boolean(), z.lazy(() => UserArgsObjectSchema)]).optional(),
  tokens: z.union([z.boolean(), z.lazy(() => TokenFindManySchema)]).optional(),
  _count: z.union([z.boolean(), z.lazy(() => OrganizationUserCountOutputTypeArgsObjectSchema)]).optional()
}).strict();
export const OrganizationUserIncludeObjectSchema: z.ZodType<Prisma.OrganizationUserInclude> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserInclude>;
export const OrganizationUserIncludeObjectZodSchema = makeSchema();
