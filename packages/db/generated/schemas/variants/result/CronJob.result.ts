import * as z from 'zod';
// prettier-ignore
export const CronJobResultSchema = z.object({
    id: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    name: z.string(),
    jobId: z.string(),
    description: z.string().nullable(),
    pattern: z.string(),
    enabled: z.boolean(),
    handler: z.string(),
    payload: z.unknown().nullable(),
    maxAttempts: z.number().int(),
    backoffMs: z.number().int(),
    createdById: z.string().nullable(),
    createdBy: z.unknown().nullable()
}).strict();

export type CronJobResultType = z.infer<typeof CronJobResultSchema>;
