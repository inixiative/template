import * as z from 'zod';

export const CronJobScalarFieldEnumSchema = z.enum(['id', 'createdAt', 'updatedAt', 'name', 'jobId', 'description', 'pattern', 'enabled', 'handler', 'payload', 'maxAttempts', 'backoffMs', 'createdById'])

export type CronJobScalarFieldEnum = z.infer<typeof CronJobScalarFieldEnumSchema>;