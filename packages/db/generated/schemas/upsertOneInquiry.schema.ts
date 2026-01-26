import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { InquirySelectObjectSchema as InquirySelectObjectSchema } from './objects/InquirySelect.schema';
import { InquiryIncludeObjectSchema as InquiryIncludeObjectSchema } from './objects/InquiryInclude.schema';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './objects/InquiryWhereUniqueInput.schema';
import { InquiryCreateInputObjectSchema as InquiryCreateInputObjectSchema } from './objects/InquiryCreateInput.schema';
import { InquiryUncheckedCreateInputObjectSchema as InquiryUncheckedCreateInputObjectSchema } from './objects/InquiryUncheckedCreateInput.schema';
import { InquiryUpdateInputObjectSchema as InquiryUpdateInputObjectSchema } from './objects/InquiryUpdateInput.schema';
import { InquiryUncheckedUpdateInputObjectSchema as InquiryUncheckedUpdateInputObjectSchema } from './objects/InquiryUncheckedUpdateInput.schema';

export const InquiryUpsertOneSchema: z.ZodType<Prisma.InquiryUpsertArgs> = z.object({ select: InquirySelectObjectSchema.optional(), include: InquiryIncludeObjectSchema.optional(), where: InquiryWhereUniqueInputObjectSchema, create: z.union([ InquiryCreateInputObjectSchema, InquiryUncheckedCreateInputObjectSchema ]), update: z.union([ InquiryUpdateInputObjectSchema, InquiryUncheckedUpdateInputObjectSchema ]) }).strict() as unknown as z.ZodType<Prisma.InquiryUpsertArgs>;

export const InquiryUpsertOneZodSchema = z.object({ select: InquirySelectObjectSchema.optional(), include: InquiryIncludeObjectSchema.optional(), where: InquiryWhereUniqueInputObjectSchema, create: z.union([ InquiryCreateInputObjectSchema, InquiryUncheckedCreateInputObjectSchema ]), update: z.union([ InquiryUpdateInputObjectSchema, InquiryUncheckedUpdateInputObjectSchema ]) }).strict();