import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryCreateManySourceUserInputObjectSchema as InquiryCreateManySourceUserInputObjectSchema } from './InquiryCreateManySourceUserInput.schema'

const makeSchema = () => z.object({
  data: z.union([z.lazy(() => InquiryCreateManySourceUserInputObjectSchema), z.lazy(() => InquiryCreateManySourceUserInputObjectSchema).array()]),
  skipDuplicates: z.boolean().optional()
}).strict();
export const InquiryCreateManySourceUserInputEnvelopeObjectSchema: z.ZodType<Prisma.InquiryCreateManySourceUserInputEnvelope> = makeSchema() as unknown as z.ZodType<Prisma.InquiryCreateManySourceUserInputEnvelope>;
export const InquiryCreateManySourceUserInputEnvelopeObjectZodSchema = makeSchema();
