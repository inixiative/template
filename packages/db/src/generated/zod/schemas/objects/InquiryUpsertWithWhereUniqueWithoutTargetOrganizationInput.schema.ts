import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema';
import { InquiryUpdateWithoutTargetOrganizationInputObjectSchema as InquiryUpdateWithoutTargetOrganizationInputObjectSchema } from './InquiryUpdateWithoutTargetOrganizationInput.schema';
import { InquiryUncheckedUpdateWithoutTargetOrganizationInputObjectSchema as InquiryUncheckedUpdateWithoutTargetOrganizationInputObjectSchema } from './InquiryUncheckedUpdateWithoutTargetOrganizationInput.schema';
import { InquiryCreateWithoutTargetOrganizationInputObjectSchema as InquiryCreateWithoutTargetOrganizationInputObjectSchema } from './InquiryCreateWithoutTargetOrganizationInput.schema';
import { InquiryUncheckedCreateWithoutTargetOrganizationInputObjectSchema as InquiryUncheckedCreateWithoutTargetOrganizationInputObjectSchema } from './InquiryUncheckedCreateWithoutTargetOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => InquiryWhereUniqueInputObjectSchema),
  update: z.union([z.lazy(() => InquiryUpdateWithoutTargetOrganizationInputObjectSchema), z.lazy(() => InquiryUncheckedUpdateWithoutTargetOrganizationInputObjectSchema)]),
  create: z.union([z.lazy(() => InquiryCreateWithoutTargetOrganizationInputObjectSchema), z.lazy(() => InquiryUncheckedCreateWithoutTargetOrganizationInputObjectSchema)])
}).strict();
export const InquiryUpsertWithWhereUniqueWithoutTargetOrganizationInputObjectSchema: z.ZodType<Prisma.InquiryUpsertWithWhereUniqueWithoutTargetOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUpsertWithWhereUniqueWithoutTargetOrganizationInput>;
export const InquiryUpsertWithWhereUniqueWithoutTargetOrganizationInputObjectZodSchema = makeSchema();
