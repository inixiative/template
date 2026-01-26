import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema';
import { InquiryUpdateWithoutTargetOrganizationInputObjectSchema as InquiryUpdateWithoutTargetOrganizationInputObjectSchema } from './InquiryUpdateWithoutTargetOrganizationInput.schema';
import { InquiryUncheckedUpdateWithoutTargetOrganizationInputObjectSchema as InquiryUncheckedUpdateWithoutTargetOrganizationInputObjectSchema } from './InquiryUncheckedUpdateWithoutTargetOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => InquiryWhereUniqueInputObjectSchema),
  data: z.union([z.lazy(() => InquiryUpdateWithoutTargetOrganizationInputObjectSchema), z.lazy(() => InquiryUncheckedUpdateWithoutTargetOrganizationInputObjectSchema)])
}).strict();
export const InquiryUpdateWithWhereUniqueWithoutTargetOrganizationInputObjectSchema: z.ZodType<Prisma.InquiryUpdateWithWhereUniqueWithoutTargetOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUpdateWithWhereUniqueWithoutTargetOrganizationInput>;
export const InquiryUpdateWithWhereUniqueWithoutTargetOrganizationInputObjectZodSchema = makeSchema();
