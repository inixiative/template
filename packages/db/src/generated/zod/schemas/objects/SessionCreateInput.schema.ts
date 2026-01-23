import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserCreateNestedOneWithoutSessionsInputObjectSchema as UserCreateNestedOneWithoutSessionsInputObjectSchema } from './UserCreateNestedOneWithoutSessionsInput.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  token: z.string().max(255),
  expiresAt: z.coerce.date(),
  ipAddress: z.string().max(45).optional().nullable(),
  userAgent: z.string().max(512).optional().nullable(),
  createdAt: z.coerce.date().optional(),
  user: z.lazy(() => UserCreateNestedOneWithoutSessionsInputObjectSchema)
}).strict();
export const SessionCreateInputObjectSchema: z.ZodType<Prisma.SessionCreateInput> = makeSchema() as unknown as z.ZodType<Prisma.SessionCreateInput>;
export const SessionCreateInputObjectZodSchema = makeSchema();
