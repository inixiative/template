import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserArgsObjectSchema as UserArgsObjectSchema } from './UserArgs.schema'

const makeSchema = () => z.object({
  id: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  name: z.boolean().optional(),
  jobId: z.boolean().optional(),
  description: z.boolean().optional(),
  pattern: z.boolean().optional(),
  enabled: z.boolean().optional(),
  handler: z.boolean().optional(),
  payload: z.boolean().optional(),
  maxAttempts: z.boolean().optional(),
  backoffMs: z.boolean().optional(),
  createdById: z.boolean().optional(),
  createdBy: z.union([z.boolean(), z.lazy(() => UserArgsObjectSchema)]).optional()
}).strict();
export const CronJobSelectObjectSchema: z.ZodType<Prisma.CronJobSelect> = makeSchema() as unknown as z.ZodType<Prisma.CronJobSelect>;
export const CronJobSelectObjectZodSchema = makeSchema();
