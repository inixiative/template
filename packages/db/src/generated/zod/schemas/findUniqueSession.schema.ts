import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { SessionWhereUniqueInputObjectSchema as SessionWhereUniqueInputObjectSchema } from './objects/SessionWhereUniqueInput.schema';

export const SessionFindUniqueSchema: z.ZodType<Prisma.SessionFindUniqueArgs> = z.object({   where: SessionWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.SessionFindUniqueArgs>;

export const SessionFindUniqueZodSchema = z.object({   where: SessionWhereUniqueInputObjectSchema }).strict();