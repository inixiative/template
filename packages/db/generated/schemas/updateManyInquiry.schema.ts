import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { InquiryUpdateManyMutationInputObjectSchema as InquiryUpdateManyMutationInputObjectSchema } from './objects/InquiryUpdateManyMutationInput.schema';
import { InquiryWhereInputObjectSchema as InquiryWhereInputObjectSchema } from './objects/InquiryWhereInput.schema';

export const InquiryUpdateManySchema: z.ZodType<Prisma.InquiryUpdateManyArgs> = z.object({ data: InquiryUpdateManyMutationInputObjectSchema, where: InquiryWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.InquiryUpdateManyArgs>;

export const InquiryUpdateManyZodSchema = z.object({ data: InquiryUpdateManyMutationInputObjectSchema, where: InquiryWhereInputObjectSchema.optional() }).strict();