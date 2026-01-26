import * as z from 'zod';
export const CronJobFindManyResultSchema = z.object({
  data: z.array(z.object({
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
})),
  pagination: z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasNext: z.boolean(),
  hasPrev: z.boolean()
})
});