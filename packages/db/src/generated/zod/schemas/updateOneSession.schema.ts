import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { SessionUpdateInputObjectSchema as SessionUpdateInputObjectSchema } from './objects/SessionUpdateInput.schema';
import { SessionUncheckedUpdateInputObjectSchema as SessionUncheckedUpdateInputObjectSchema } from './objects/SessionUncheckedUpdateInput.schema';
import { SessionWhereUniqueInputObjectSchema as SessionWhereUniqueInputObjectSchema } from './objects/SessionWhereUniqueInput.schema';

export const SessionUpdateOneSchema: z.ZodType<Prisma.SessionUpdateArgs> = z.object({   data: z.union([SessionUpdateInputObjectSchema, SessionUncheckedUpdateInputObjectSchema]), where: SessionWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.SessionUpdateArgs>;

export const SessionUpdateOneZodSchema = z.object({   data: z.union([SessionUpdateInputObjectSchema, SessionUncheckedUpdateInputObjectSchema]), where: SessionWhereUniqueInputObjectSchema }).strict();