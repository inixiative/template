import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { SessionCreateManyInputObjectSchema as SessionCreateManyInputObjectSchema } from './objects/SessionCreateManyInput.schema';

export const SessionCreateManyAndReturnSchema: z.ZodType<Prisma.SessionCreateManyAndReturnArgs> = z.object({  data: z.union([ SessionCreateManyInputObjectSchema, z.array(SessionCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.SessionCreateManyAndReturnArgs>;

export const SessionCreateManyAndReturnZodSchema = z.object({  data: z.union([ SessionCreateManyInputObjectSchema, z.array(SessionCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();