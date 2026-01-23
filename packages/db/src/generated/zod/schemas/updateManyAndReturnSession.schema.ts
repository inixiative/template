import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { SessionUpdateManyMutationInputObjectSchema as SessionUpdateManyMutationInputObjectSchema } from './objects/SessionUpdateManyMutationInput.schema';
import { SessionWhereInputObjectSchema as SessionWhereInputObjectSchema } from './objects/SessionWhereInput.schema';

export const SessionUpdateManyAndReturnSchema: z.ZodType<Prisma.SessionUpdateManyAndReturnArgs> = z.object({  data: SessionUpdateManyMutationInputObjectSchema, where: SessionWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.SessionUpdateManyAndReturnArgs>;

export const SessionUpdateManyAndReturnZodSchema = z.object({  data: SessionUpdateManyMutationInputObjectSchema, where: SessionWhereInputObjectSchema.optional() }).strict();