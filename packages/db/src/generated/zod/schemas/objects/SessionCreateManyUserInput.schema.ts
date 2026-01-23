import * as z from 'zod';
import type { Prisma } from '../../../client/client';


const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  token: z.string().max(255),
  expiresAt: z.coerce.date(),
  ipAddress: z.string().max(45).optional().nullable(),
  userAgent: z.string().max(512).optional().nullable(),
  createdAt: z.coerce.date().optional()
}).strict();
export const SessionCreateManyUserInputObjectSchema: z.ZodType<Prisma.SessionCreateManyUserInput> = makeSchema() as unknown as z.ZodType<Prisma.SessionCreateManyUserInput>;
export const SessionCreateManyUserInputObjectZodSchema = makeSchema();
