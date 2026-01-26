import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema';
import { InquiryUpdateWithoutSourceOrganizationInputObjectSchema as InquiryUpdateWithoutSourceOrganizationInputObjectSchema } from './InquiryUpdateWithoutSourceOrganizationInput.schema';
import { InquiryUncheckedUpdateWithoutSourceOrganizationInputObjectSchema as InquiryUncheckedUpdateWithoutSourceOrganizationInputObjectSchema } from './InquiryUncheckedUpdateWithoutSourceOrganizationInput.schema';
import { InquiryCreateWithoutSourceOrganizationInputObjectSchema as InquiryCreateWithoutSourceOrganizationInputObjectSchema } from './InquiryCreateWithoutSourceOrganizationInput.schema';
import { InquiryUncheckedCreateWithoutSourceOrganizationInputObjectSchema as InquiryUncheckedCreateWithoutSourceOrganizationInputObjectSchema } from './InquiryUncheckedCreateWithoutSourceOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => InquiryWhereUniqueInputObjectSchema),
  update: z.union([z.lazy(() => InquiryUpdateWithoutSourceOrganizationInputObjectSchema), z.lazy(() => InquiryUncheckedUpdateWithoutSourceOrganizationInputObjectSchema)]),
  create: z.union([z.lazy(() => InquiryCreateWithoutSourceOrganizationInputObjectSchema), z.lazy(() => InquiryUncheckedCreateWithoutSourceOrganizationInputObjectSchema)])
}).strict();
export const InquiryUpsertWithWhereUniqueWithoutSourceOrganizationInputObjectSchema: z.ZodType<Prisma.InquiryUpsertWithWhereUniqueWithoutSourceOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUpsertWithWhereUniqueWithoutSourceOrganizationInput>;
export const InquiryUpsertWithWhereUniqueWithoutSourceOrganizationInputObjectZodSchema = makeSchema();
