import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { InquiryWhereInputObjectSchema as InquiryWhereInputObjectSchema } from './objects/InquiryWhereInput.schema';

export const InquiryDeleteManySchema: z.ZodType<Prisma.InquiryDeleteManyArgs> = z.object({ where: InquiryWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.InquiryDeleteManyArgs>;

export const InquiryDeleteManyZodSchema = z.object({ where: InquiryWhereInputObjectSchema.optional() }).strict();