import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryCreateWithoutSourceOrganizationInputObjectSchema as InquiryCreateWithoutSourceOrganizationInputObjectSchema } from './InquiryCreateWithoutSourceOrganizationInput.schema';
import { InquiryUncheckedCreateWithoutSourceOrganizationInputObjectSchema as InquiryUncheckedCreateWithoutSourceOrganizationInputObjectSchema } from './InquiryUncheckedCreateWithoutSourceOrganizationInput.schema';
import { InquiryCreateOrConnectWithoutSourceOrganizationInputObjectSchema as InquiryCreateOrConnectWithoutSourceOrganizationInputObjectSchema } from './InquiryCreateOrConnectWithoutSourceOrganizationInput.schema';
import { InquiryCreateManySourceOrganizationInputEnvelopeObjectSchema as InquiryCreateManySourceOrganizationInputEnvelopeObjectSchema } from './InquiryCreateManySourceOrganizationInputEnvelope.schema';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => InquiryCreateWithoutSourceOrganizationInputObjectSchema), z.lazy(() => InquiryCreateWithoutSourceOrganizationInputObjectSchema).array(), z.lazy(() => InquiryUncheckedCreateWithoutSourceOrganizationInputObjectSchema), z.lazy(() => InquiryUncheckedCreateWithoutSourceOrganizationInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => InquiryCreateOrConnectWithoutSourceOrganizationInputObjectSchema), z.lazy(() => InquiryCreateOrConnectWithoutSourceOrganizationInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => InquiryCreateManySourceOrganizationInputEnvelopeObjectSchema).optional(),
  connect: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional()
}).strict();
export const InquiryCreateNestedManyWithoutSourceOrganizationInputObjectSchema: z.ZodType<Prisma.InquiryCreateNestedManyWithoutSourceOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryCreateNestedManyWithoutSourceOrganizationInput>;
export const InquiryCreateNestedManyWithoutSourceOrganizationInputObjectZodSchema = makeSchema();
