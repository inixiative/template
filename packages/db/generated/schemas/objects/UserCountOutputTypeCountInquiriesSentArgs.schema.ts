import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryWhereInputObjectSchema as InquiryWhereInputObjectSchema } from './InquiryWhereInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => InquiryWhereInputObjectSchema).optional()
}).strict();
export const UserCountOutputTypeCountInquiriesSentArgsObjectSchema = makeSchema();
export const UserCountOutputTypeCountInquiriesSentArgsObjectZodSchema = makeSchema();
