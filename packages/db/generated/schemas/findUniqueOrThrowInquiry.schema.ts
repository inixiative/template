import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { InquirySelectObjectSchema as InquirySelectObjectSchema } from './objects/InquirySelect.schema';
import { InquiryIncludeObjectSchema as InquiryIncludeObjectSchema } from './objects/InquiryInclude.schema';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './objects/InquiryWhereUniqueInput.schema';

export const InquiryFindUniqueOrThrowSchema: z.ZodType<Prisma.InquiryFindUniqueOrThrowArgs> = z.object({ select: InquirySelectObjectSchema.optional(), include: InquiryIncludeObjectSchema.optional(), where: InquiryWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.InquiryFindUniqueOrThrowArgs>;

export const InquiryFindUniqueOrThrowZodSchema = z.object({ select: InquirySelectObjectSchema.optional(), include: InquiryIncludeObjectSchema.optional(), where: InquiryWhereUniqueInputObjectSchema }).strict();