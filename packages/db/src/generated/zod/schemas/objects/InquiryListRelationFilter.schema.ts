import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryWhereInputObjectSchema as InquiryWhereInputObjectSchema } from './InquiryWhereInput.schema'

const makeSchema = () => z.object({
  every: z.lazy(() => InquiryWhereInputObjectSchema).optional(),
  some: z.lazy(() => InquiryWhereInputObjectSchema).optional(),
  none: z.lazy(() => InquiryWhereInputObjectSchema).optional()
}).strict();
export const InquiryListRelationFilterObjectSchema: z.ZodType<Prisma.InquiryListRelationFilter> = makeSchema() as unknown as z.ZodType<Prisma.InquiryListRelationFilter>;
export const InquiryListRelationFilterObjectZodSchema = makeSchema();
