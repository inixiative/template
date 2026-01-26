import * as z from 'zod';
export const CronJobAggregateResultSchema = z.object({  _count: z.object({
    id: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    name: z.number(),
    jobId: z.number(),
    description: z.number(),
    pattern: z.number(),
    enabled: z.number(),
    handler: z.number(),
    payload: z.number(),
    maxAttempts: z.number(),
    backoffMs: z.number(),
    createdById: z.number(),
    createdBy: z.number()
  }).optional(),
  _sum: z.object({
    maxAttempts: z.number().nullable(),
    backoffMs: z.number().nullable()
  }).nullable().optional(),
  _avg: z.object({
    maxAttempts: z.number().nullable(),
    backoffMs: z.number().nullable()
  }).nullable().optional(),
  _min: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
    name: z.string().nullable(),
    jobId: z.string().nullable(),
    description: z.string().nullable(),
    pattern: z.string().nullable(),
    handler: z.string().nullable(),
    maxAttempts: z.number().int().nullable(),
    backoffMs: z.number().int().nullable(),
    createdById: z.string().nullable()
  }).nullable().optional(),
  _max: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
    name: z.string().nullable(),
    jobId: z.string().nullable(),
    description: z.string().nullable(),
    pattern: z.string().nullable(),
    handler: z.string().nullable(),
    maxAttempts: z.number().int().nullable(),
    backoffMs: z.number().int().nullable(),
    createdById: z.string().nullable()
  }).nullable().optional()});