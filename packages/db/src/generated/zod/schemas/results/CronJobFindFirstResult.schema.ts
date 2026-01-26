import * as z from 'zod';
export const CronJobFindFirstResultSchema = z.nullable(z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  jobId: z.string(),
  description: z.string().optional(),
  pattern: z.string(),
  enabled: z.boolean(),
  handler: z.string(),
  payload: z.unknown().optional(),
  maxAttempts: z.number().int(),
  backoffMs: z.number().int(),
  createdById: z.string().optional(),
  createdBy: z.unknown().optional()
}));