import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationCountOutputTypeSelectObjectSchema as OrganizationCountOutputTypeSelectObjectSchema } from './OrganizationCountOutputTypeSelect.schema'

const makeSchema = () => z.object({
  select: z.lazy(() => OrganizationCountOutputTypeSelectObjectSchema).optional()
}).strict();
export const OrganizationCountOutputTypeArgsObjectSchema = makeSchema();
export const OrganizationCountOutputTypeArgsObjectZodSchema = makeSchema();
