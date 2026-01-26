import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { InquirySelectObjectSchema as InquirySelectObjectSchema } from './objects/InquirySelect.schema';
import { InquiryIncludeObjectSchema as InquiryIncludeObjectSchema } from './objects/InquiryInclude.schema';
import { InquiryCreateInputObjectSchema as InquiryCreateInputObjectSchema } from './objects/InquiryCreateInput.schema';
import { InquiryUncheckedCreateInputObjectSchema as InquiryUncheckedCreateInputObjectSchema } from './objects/InquiryUncheckedCreateInput.schema';

export const InquiryCreateOneSchema: z.ZodType<Prisma.InquiryCreateArgs> = z.object({ select: InquirySelectObjectSchema.optional(), include: InquiryIncludeObjectSchema.optional(), data: z.union([InquiryCreateInputObjectSchema, InquiryUncheckedCreateInputObjectSchema]) }).strict() as unknown as z.ZodType<Prisma.InquiryCreateArgs>;

export const InquiryCreateOneZodSchema = z.object({ select: InquirySelectObjectSchema.optional(), include: InquiryIncludeObjectSchema.optional(), data: z.union([InquiryCreateInputObjectSchema, InquiryUncheckedCreateInputObjectSchema]) }).strict();