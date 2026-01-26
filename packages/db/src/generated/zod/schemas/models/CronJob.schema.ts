import * as z from 'zod';

export const CronJobSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  jobId: z.string(),
  description: z.string().nullish(),
  pattern: z.string(),
  enabled: z.boolean().default(true),
  handler: z.string(),
  payload: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").nullish(),
  maxAttempts: z.number().int().default(3),
  backoffMs: z.number().int().default(5000),
  createdById: z.string().nullish(),
});

export type CronJobType = z.infer<typeof CronJobSchema>;
