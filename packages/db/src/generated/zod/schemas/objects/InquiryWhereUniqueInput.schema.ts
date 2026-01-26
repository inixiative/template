import * as z from 'zod';
import type { Prisma } from '../../../client/client';


const makeSchema = () => z.object({
  id: z.string().max(36).optional()
}).strict();
export const InquiryWhereUniqueInputObjectSchema: z.ZodType<Prisma.InquiryWhereUniqueInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryWhereUniqueInput>;
export const InquiryWhereUniqueInputObjectZodSchema = makeSchema();
