import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema';
import { InquiryUpdateWithoutSourceOrganizationInputObjectSchema as InquiryUpdateWithoutSourceOrganizationInputObjectSchema } from './InquiryUpdateWithoutSourceOrganizationInput.schema';
import { InquiryUncheckedUpdateWithoutSourceOrganizationInputObjectSchema as InquiryUncheckedUpdateWithoutSourceOrganizationInputObjectSchema } from './InquiryUncheckedUpdateWithoutSourceOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => InquiryWhereUniqueInputObjectSchema),
  data: z.union([z.lazy(() => InquiryUpdateWithoutSourceOrganizationInputObjectSchema), z.lazy(() => InquiryUncheckedUpdateWithoutSourceOrganizationInputObjectSchema)])
}).strict();
export const InquiryUpdateWithWhereUniqueWithoutSourceOrganizationInputObjectSchema: z.ZodType<Prisma.InquiryUpdateWithWhereUniqueWithoutSourceOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUpdateWithWhereUniqueWithoutSourceOrganizationInput>;
export const InquiryUpdateWithWhereUniqueWithoutSourceOrganizationInputObjectZodSchema = makeSchema();
