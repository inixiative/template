import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { InquirySelectObjectSchema as InquirySelectObjectSchema } from './objects/InquirySelect.schema';
import { InquiryIncludeObjectSchema as InquiryIncludeObjectSchema } from './objects/InquiryInclude.schema';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './objects/InquiryWhereUniqueInput.schema';

export const InquiryDeleteOneSchema: z.ZodType<Prisma.InquiryDeleteArgs> = z.object({ select: InquirySelectObjectSchema.optional(), include: InquiryIncludeObjectSchema.optional(), where: InquiryWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.InquiryDeleteArgs>;

export const InquiryDeleteOneZodSchema = z.object({ select: InquirySelectObjectSchema.optional(), include: InquiryIncludeObjectSchema.optional(), where: InquiryWhereUniqueInputObjectSchema }).strict();