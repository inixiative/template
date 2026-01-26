import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema';
import { InquiryCreateWithoutSourceOrganizationInputObjectSchema as InquiryCreateWithoutSourceOrganizationInputObjectSchema } from './InquiryCreateWithoutSourceOrganizationInput.schema';
import { InquiryUncheckedCreateWithoutSourceOrganizationInputObjectSchema as InquiryUncheckedCreateWithoutSourceOrganizationInputObjectSchema } from './InquiryUncheckedCreateWithoutSourceOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => InquiryWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => InquiryCreateWithoutSourceOrganizationInputObjectSchema), z.lazy(() => InquiryUncheckedCreateWithoutSourceOrganizationInputObjectSchema)])
}).strict();
export const InquiryCreateOrConnectWithoutSourceOrganizationInputObjectSchema: z.ZodType<Prisma.InquiryCreateOrConnectWithoutSourceOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryCreateOrConnectWithoutSourceOrganizationInput>;
export const InquiryCreateOrConnectWithoutSourceOrganizationInputObjectZodSchema = makeSchema();
