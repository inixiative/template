import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { InquirySelectObjectSchema as InquirySelectObjectSchema } from './objects/InquirySelect.schema';
import { InquiryCreateManyInputObjectSchema as InquiryCreateManyInputObjectSchema } from './objects/InquiryCreateManyInput.schema';

export const InquiryCreateManyAndReturnSchema: z.ZodType<Prisma.InquiryCreateManyAndReturnArgs> = z.object({ select: InquirySelectObjectSchema.optional(), data: z.union([ InquiryCreateManyInputObjectSchema, z.array(InquiryCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.InquiryCreateManyAndReturnArgs>;

export const InquiryCreateManyAndReturnZodSchema = z.object({ select: InquirySelectObjectSchema.optional(), data: z.union([ InquiryCreateManyInputObjectSchema, z.array(InquiryCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();