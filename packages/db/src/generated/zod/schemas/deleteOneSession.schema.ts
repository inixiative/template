import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { SessionWhereUniqueInputObjectSchema as SessionWhereUniqueInputObjectSchema } from './objects/SessionWhereUniqueInput.schema';

export const SessionDeleteOneSchema: z.ZodType<Prisma.SessionDeleteArgs> = z.object({   where: SessionWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.SessionDeleteArgs>;

export const SessionDeleteOneZodSchema = z.object({   where: SessionWhereUniqueInputObjectSchema }).strict();