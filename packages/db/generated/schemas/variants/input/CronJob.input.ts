import * as z from 'zod';
// prettier-ignore
export const CronJobInputSchema = z.object({
    id: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    name: z.string(),
    jobId: z.string(),
    description: z.string().optional().nullable(),
    pattern: z.string(),
    enabled: z.boolean(),
    handler: z.string(),
    payload: z.unknown().optional().nullable(),
    maxAttempts: z.number().int(),
    backoffMs: z.number().int(),
    createdById: z.string().optional().nullable(),
    createdBy: z.unknown().optional().nullable()
}).strict();

export type CronJobInputType = z.infer<typeof CronJobInputSchema>;
