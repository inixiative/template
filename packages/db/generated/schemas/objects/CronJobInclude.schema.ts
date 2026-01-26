import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserArgsObjectSchema as UserArgsObjectSchema } from './UserArgs.schema'

const makeSchema = () => z.object({
  createdBy: z.union([z.boolean(), z.lazy(() => UserArgsObjectSchema)]).optional()
}).strict();
export const CronJobIncludeObjectSchema: z.ZodType<Prisma.CronJobInclude> = makeSchema() as unknown as z.ZodType<Prisma.CronJobInclude>;
export const CronJobIncludeObjectZodSchema = makeSchema();
