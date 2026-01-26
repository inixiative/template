import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryCreateManySourceOrganizationInputObjectSchema as InquiryCreateManySourceOrganizationInputObjectSchema } from './InquiryCreateManySourceOrganizationInput.schema'

const makeSchema = () => z.object({
  data: z.union([z.lazy(() => InquiryCreateManySourceOrganizationInputObjectSchema), z.lazy(() => InquiryCreateManySourceOrganizationInputObjectSchema).array()]),
  skipDuplicates: z.boolean().optional()
}).strict();
export const InquiryCreateManySourceOrganizationInputEnvelopeObjectSchema: z.ZodType<Prisma.InquiryCreateManySourceOrganizationInputEnvelope> = makeSchema() as unknown as z.ZodType<Prisma.InquiryCreateManySourceOrganizationInputEnvelope>;
export const InquiryCreateManySourceOrganizationInputEnvelopeObjectZodSchema = makeSchema();
