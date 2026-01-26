import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationSelectObjectSchema as OrganizationSelectObjectSchema } from './OrganizationSelect.schema';
import { OrganizationIncludeObjectSchema as OrganizationIncludeObjectSchema } from './OrganizationInclude.schema'

const makeSchema = () => z.object({
  select: z.lazy(() => OrganizationSelectObjectSchema).optional(),
  include: z.lazy(() => OrganizationIncludeObjectSchema).optional()
}).strict();
export const OrganizationArgsObjectSchema = makeSchema();
export const OrganizationArgsObjectZodSchema = makeSchema();
