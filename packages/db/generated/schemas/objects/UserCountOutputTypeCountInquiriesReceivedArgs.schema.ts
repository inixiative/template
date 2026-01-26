import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryWhereInputObjectSchema as InquiryWhereInputObjectSchema } from './InquiryWhereInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => InquiryWhereInputObjectSchema).optional()
}).strict();
export const UserCountOutputTypeCountInquiriesReceivedArgsObjectSchema = makeSchema();
export const UserCountOutputTypeCountInquiriesReceivedArgsObjectZodSchema = makeSchema();
