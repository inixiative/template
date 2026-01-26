import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquirySelectObjectSchema as InquirySelectObjectSchema } from './InquirySelect.schema';
import { InquiryIncludeObjectSchema as InquiryIncludeObjectSchema } from './InquiryInclude.schema'

const makeSchema = () => z.object({
  select: z.lazy(() => InquirySelectObjectSchema).optional(),
  include: z.lazy(() => InquiryIncludeObjectSchema).optional()
}).strict();
export const InquiryArgsObjectSchema = makeSchema();
export const InquiryArgsObjectZodSchema = makeSchema();
