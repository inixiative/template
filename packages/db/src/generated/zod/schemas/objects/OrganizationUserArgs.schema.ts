import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUserSelectObjectSchema as OrganizationUserSelectObjectSchema } from './OrganizationUserSelect.schema';
import { OrganizationUserIncludeObjectSchema as OrganizationUserIncludeObjectSchema } from './OrganizationUserInclude.schema'

const makeSchema = () => z.object({
  select: z.lazy(() => OrganizationUserSelectObjectSchema).optional(),
  include: z.lazy(() => OrganizationUserIncludeObjectSchema).optional()
}).strict();
export const OrganizationUserArgsObjectSchema = makeSchema();
export const OrganizationUserArgsObjectZodSchema = makeSchema();
