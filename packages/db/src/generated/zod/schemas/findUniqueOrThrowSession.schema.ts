import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { SessionWhereUniqueInputObjectSchema as SessionWhereUniqueInputObjectSchema } from './objects/SessionWhereUniqueInput.schema';

export const SessionFindUniqueOrThrowSchema: z.ZodType<Prisma.SessionFindUniqueOrThrowArgs> = z.object({   where: SessionWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.SessionFindUniqueOrThrowArgs>;

export const SessionFindUniqueOrThrowZodSchema = z.object({   where: SessionWhereUniqueInputObjectSchema }).strict();