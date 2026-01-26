import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { CronJobSelectObjectSchema as CronJobSelectObjectSchema } from './CronJobSelect.schema';
import { CronJobIncludeObjectSchema as CronJobIncludeObjectSchema } from './CronJobInclude.schema'

const makeSchema = () => z.object({
  select: z.lazy(() => CronJobSelectObjectSchema).optional(),
  include: z.lazy(() => CronJobIncludeObjectSchema).optional()
}).strict();
export const CronJobArgsObjectSchema = makeSchema();
export const CronJobArgsObjectZodSchema = makeSchema();
