import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema';
import { InquiryCreateWithoutTargetOrganizationInputObjectSchema as InquiryCreateWithoutTargetOrganizationInputObjectSchema } from './InquiryCreateWithoutTargetOrganizationInput.schema';
import { InquiryUncheckedCreateWithoutTargetOrganizationInputObjectSchema as InquiryUncheckedCreateWithoutTargetOrganizationInputObjectSchema } from './InquiryUncheckedCreateWithoutTargetOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => InquiryWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => InquiryCreateWithoutTargetOrganizationInputObjectSchema), z.lazy(() => InquiryUncheckedCreateWithoutTargetOrganizationInputObjectSchema)])
}).strict();
export const InquiryCreateOrConnectWithoutTargetOrganizationInputObjectSchema: z.ZodType<Prisma.InquiryCreateOrConnectWithoutTargetOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryCreateOrConnectWithoutTargetOrganizationInput>;
export const InquiryCreateOrConnectWithoutTargetOrganizationInputObjectZodSchema = makeSchema();
