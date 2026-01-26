import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryCreateManyTargetUserInputObjectSchema as InquiryCreateManyTargetUserInputObjectSchema } from './InquiryCreateManyTargetUserInput.schema'

const makeSchema = () => z.object({
  data: z.union([z.lazy(() => InquiryCreateManyTargetUserInputObjectSchema), z.lazy(() => InquiryCreateManyTargetUserInputObjectSchema).array()]),
  skipDuplicates: z.boolean().optional()
}).strict();
export const InquiryCreateManyTargetUserInputEnvelopeObjectSchema: z.ZodType<Prisma.InquiryCreateManyTargetUserInputEnvelope> = makeSchema() as unknown as z.ZodType<Prisma.InquiryCreateManyTargetUserInputEnvelope>;
export const InquiryCreateManyTargetUserInputEnvelopeObjectZodSchema = makeSchema();
