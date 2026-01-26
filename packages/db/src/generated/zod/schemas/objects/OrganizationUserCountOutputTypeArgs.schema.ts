import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUserCountOutputTypeSelectObjectSchema as OrganizationUserCountOutputTypeSelectObjectSchema } from './OrganizationUserCountOutputTypeSelect.schema'

const makeSchema = () => z.object({
  select: z.lazy(() => OrganizationUserCountOutputTypeSelectObjectSchema).optional()
}).strict();
export const OrganizationUserCountOutputTypeArgsObjectSchema = makeSchema();
export const OrganizationUserCountOutputTypeArgsObjectZodSchema = makeSchema();
