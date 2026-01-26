import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { InquirySelectObjectSchema as InquirySelectObjectSchema } from './objects/InquirySelect.schema';
import { InquiryUpdateManyMutationInputObjectSchema as InquiryUpdateManyMutationInputObjectSchema } from './objects/InquiryUpdateManyMutationInput.schema';
import { InquiryWhereInputObjectSchema as InquiryWhereInputObjectSchema } from './objects/InquiryWhereInput.schema';

export const InquiryUpdateManyAndReturnSchema: z.ZodType<Prisma.InquiryUpdateManyAndReturnArgs> = z.object({ select: InquirySelectObjectSchema.optional(), data: InquiryUpdateManyMutationInputObjectSchema, where: InquiryWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.InquiryUpdateManyAndReturnArgs>;

export const InquiryUpdateManyAndReturnZodSchema = z.object({ select: InquirySelectObjectSchema.optional(), data: InquiryUpdateManyMutationInputObjectSchema, where: InquiryWhereInputObjectSchema.optional() }).strict();