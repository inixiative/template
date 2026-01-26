import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { InquirySelectObjectSchema as InquirySelectObjectSchema } from './objects/InquirySelect.schema';
import { InquiryIncludeObjectSchema as InquiryIncludeObjectSchema } from './objects/InquiryInclude.schema';
import { InquiryUpdateInputObjectSchema as InquiryUpdateInputObjectSchema } from './objects/InquiryUpdateInput.schema';
import { InquiryUncheckedUpdateInputObjectSchema as InquiryUncheckedUpdateInputObjectSchema } from './objects/InquiryUncheckedUpdateInput.schema';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './objects/InquiryWhereUniqueInput.schema';

export const InquiryUpdateOneSchema: z.ZodType<Prisma.InquiryUpdateArgs> = z.object({ select: InquirySelectObjectSchema.optional(), include: InquiryIncludeObjectSchema.optional(), data: z.union([InquiryUpdateInputObjectSchema, InquiryUncheckedUpdateInputObjectSchema]), where: InquiryWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.InquiryUpdateArgs>;

export const InquiryUpdateOneZodSchema = z.object({ select: InquirySelectObjectSchema.optional(), include: InquiryIncludeObjectSchema.optional(), data: z.union([InquiryUpdateInputObjectSchema, InquiryUncheckedUpdateInputObjectSchema]), where: InquiryWhereUniqueInputObjectSchema }).strict();