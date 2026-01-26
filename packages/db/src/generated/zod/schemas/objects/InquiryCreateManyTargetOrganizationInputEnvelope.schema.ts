import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryCreateManyTargetOrganizationInputObjectSchema as InquiryCreateManyTargetOrganizationInputObjectSchema } from './InquiryCreateManyTargetOrganizationInput.schema'

const makeSchema = () => z.object({
  data: z.union([z.lazy(() => InquiryCreateManyTargetOrganizationInputObjectSchema), z.lazy(() => InquiryCreateManyTargetOrganizationInputObjectSchema).array()]),
  skipDuplicates: z.boolean().optional()
}).strict();
export const InquiryCreateManyTargetOrganizationInputEnvelopeObjectSchema: z.ZodType<Prisma.InquiryCreateManyTargetOrganizationInputEnvelope> = makeSchema() as unknown as z.ZodType<Prisma.InquiryCreateManyTargetOrganizationInputEnvelope>;
export const InquiryCreateManyTargetOrganizationInputEnvelopeObjectZodSchema = makeSchema();
