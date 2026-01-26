import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { InquiryCreateManyInputObjectSchema as InquiryCreateManyInputObjectSchema } from './objects/InquiryCreateManyInput.schema';

export const InquiryCreateManySchema: z.ZodType<Prisma.InquiryCreateManyArgs> = z.object({ data: z.union([ InquiryCreateManyInputObjectSchema, z.array(InquiryCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.InquiryCreateManyArgs>;

export const InquiryCreateManyZodSchema = z.object({ data: z.union([ InquiryCreateManyInputObjectSchema, z.array(InquiryCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();