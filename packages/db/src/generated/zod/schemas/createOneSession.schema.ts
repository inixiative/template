import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { SessionCreateInputObjectSchema as SessionCreateInputObjectSchema } from './objects/SessionCreateInput.schema';
import { SessionUncheckedCreateInputObjectSchema as SessionUncheckedCreateInputObjectSchema } from './objects/SessionUncheckedCreateInput.schema';

export const SessionCreateOneSchema: z.ZodType<Prisma.SessionCreateArgs> = z.object({   data: z.union([SessionCreateInputObjectSchema, SessionUncheckedCreateInputObjectSchema]) }).strict() as unknown as z.ZodType<Prisma.SessionCreateArgs>;

export const SessionCreateOneZodSchema = z.object({   data: z.union([SessionCreateInputObjectSchema, SessionUncheckedCreateInputObjectSchema]) }).strict();