import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryCreateWithoutTargetOrganizationInputObjectSchema as InquiryCreateWithoutTargetOrganizationInputObjectSchema } from './InquiryCreateWithoutTargetOrganizationInput.schema';
import { InquiryUncheckedCreateWithoutTargetOrganizationInputObjectSchema as InquiryUncheckedCreateWithoutTargetOrganizationInputObjectSchema } from './InquiryUncheckedCreateWithoutTargetOrganizationInput.schema';
import { InquiryCreateOrConnectWithoutTargetOrganizationInputObjectSchema as InquiryCreateOrConnectWithoutTargetOrganizationInputObjectSchema } from './InquiryCreateOrConnectWithoutTargetOrganizationInput.schema';
import { InquiryCreateManyTargetOrganizationInputEnvelopeObjectSchema as InquiryCreateManyTargetOrganizationInputEnvelopeObjectSchema } from './InquiryCreateManyTargetOrganizationInputEnvelope.schema';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => InquiryCreateWithoutTargetOrganizationInputObjectSchema), z.lazy(() => InquiryCreateWithoutTargetOrganizationInputObjectSchema).array(), z.lazy(() => InquiryUncheckedCreateWithoutTargetOrganizationInputObjectSchema), z.lazy(() => InquiryUncheckedCreateWithoutTargetOrganizationInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => InquiryCreateOrConnectWithoutTargetOrganizationInputObjectSchema), z.lazy(() => InquiryCreateOrConnectWithoutTargetOrganizationInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => InquiryCreateManyTargetOrganizationInputEnvelopeObjectSchema).optional(),
  connect: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional()
}).strict();
export const InquiryUncheckedCreateNestedManyWithoutTargetOrganizationInputObjectSchema: z.ZodType<Prisma.InquiryUncheckedCreateNestedManyWithoutTargetOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUncheckedCreateNestedManyWithoutTargetOrganizationInput>;
export const InquiryUncheckedCreateNestedManyWithoutTargetOrganizationInputObjectZodSchema = makeSchema();
