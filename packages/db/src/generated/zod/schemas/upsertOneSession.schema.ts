import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { SessionWhereUniqueInputObjectSchema as SessionWhereUniqueInputObjectSchema } from './objects/SessionWhereUniqueInput.schema';
import { SessionCreateInputObjectSchema as SessionCreateInputObjectSchema } from './objects/SessionCreateInput.schema';
import { SessionUncheckedCreateInputObjectSchema as SessionUncheckedCreateInputObjectSchema } from './objects/SessionUncheckedCreateInput.schema';
import { SessionUpdateInputObjectSchema as SessionUpdateInputObjectSchema } from './objects/SessionUpdateInput.schema';
import { SessionUncheckedUpdateInputObjectSchema as SessionUncheckedUpdateInputObjectSchema } from './objects/SessionUncheckedUpdateInput.schema';

export const SessionUpsertOneSchema: z.ZodType<Prisma.SessionUpsertArgs> = z.object({   where: SessionWhereUniqueInputObjectSchema, create: z.union([ SessionCreateInputObjectSchema, SessionUncheckedCreateInputObjectSchema ]), update: z.union([ SessionUpdateInputObjectSchema, SessionUncheckedUpdateInputObjectSchema ]) }).strict() as unknown as z.ZodType<Prisma.SessionUpsertArgs>;

export const SessionUpsertOneZodSchema = z.object({   where: SessionWhereUniqueInputObjectSchema, create: z.union([ SessionCreateInputObjectSchema, SessionUncheckedCreateInputObjectSchema ]), update: z.union([ SessionUpdateInputObjectSchema, SessionUncheckedUpdateInputObjectSchema ]) }).strict();