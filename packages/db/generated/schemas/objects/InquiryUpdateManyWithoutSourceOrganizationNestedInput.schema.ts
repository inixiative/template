import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryCreateWithoutSourceOrganizationInputObjectSchema as InquiryCreateWithoutSourceOrganizationInputObjectSchema } from './InquiryCreateWithoutSourceOrganizationInput.schema';
import { InquiryUncheckedCreateWithoutSourceOrganizationInputObjectSchema as InquiryUncheckedCreateWithoutSourceOrganizationInputObjectSchema } from './InquiryUncheckedCreateWithoutSourceOrganizationInput.schema';
import { InquiryCreateOrConnectWithoutSourceOrganizationInputObjectSchema as InquiryCreateOrConnectWithoutSourceOrganizationInputObjectSchema } from './InquiryCreateOrConnectWithoutSourceOrganizationInput.schema';
import { InquiryUpsertWithWhereUniqueWithoutSourceOrganizationInputObjectSchema as InquiryUpsertWithWhereUniqueWithoutSourceOrganizationInputObjectSchema } from './InquiryUpsertWithWhereUniqueWithoutSourceOrganizationInput.schema';
import { InquiryCreateManySourceOrganizationInputEnvelopeObjectSchema as InquiryCreateManySourceOrganizationInputEnvelopeObjectSchema } from './InquiryCreateManySourceOrganizationInputEnvelope.schema';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema';
import { InquiryUpdateWithWhereUniqueWithoutSourceOrganizationInputObjectSchema as InquiryUpdateWithWhereUniqueWithoutSourceOrganizationInputObjectSchema } from './InquiryUpdateWithWhereUniqueWithoutSourceOrganizationInput.schema';
import { InquiryUpdateManyWithWhereWithoutSourceOrganizationInputObjectSchema as InquiryUpdateManyWithWhereWithoutSourceOrganizationInputObjectSchema } from './InquiryUpdateManyWithWhereWithoutSourceOrganizationInput.schema';
import { InquiryScalarWhereInputObjectSchema as InquiryScalarWhereInputObjectSchema } from './InquiryScalarWhereInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => InquiryCreateWithoutSourceOrganizationInputObjectSchema), z.lazy(() => InquiryCreateWithoutSourceOrganizationInputObjectSchema).array(), z.lazy(() => InquiryUncheckedCreateWithoutSourceOrganizationInputObjectSchema), z.lazy(() => InquiryUncheckedCreateWithoutSourceOrganizationInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => InquiryCreateOrConnectWithoutSourceOrganizationInputObjectSchema), z.lazy(() => InquiryCreateOrConnectWithoutSourceOrganizationInputObjectSchema).array()]).optional(),
  upsert: z.union([z.lazy(() => InquiryUpsertWithWhereUniqueWithoutSourceOrganizationInputObjectSchema), z.lazy(() => InquiryUpsertWithWhereUniqueWithoutSourceOrganizationInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => InquiryCreateManySourceOrganizationInputEnvelopeObjectSchema).optional(),
  set: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional(),
  disconnect: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional(),
  delete: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional(),
  connect: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional(),
  update: z.union([z.lazy(() => InquiryUpdateWithWhereUniqueWithoutSourceOrganizationInputObjectSchema), z.lazy(() => InquiryUpdateWithWhereUniqueWithoutSourceOrganizationInputObjectSchema).array()]).optional(),
  updateMany: z.union([z.lazy(() => InquiryUpdateManyWithWhereWithoutSourceOrganizationInputObjectSchema), z.lazy(() => InquiryUpdateManyWithWhereWithoutSourceOrganizationInputObjectSchema).array()]).optional(),
  deleteMany: z.union([z.lazy(() => InquiryScalarWhereInputObjectSchema), z.lazy(() => InquiryScalarWhereInputObjectSchema).array()]).optional()
}).strict();
export const InquiryUpdateManyWithoutSourceOrganizationNestedInputObjectSchema: z.ZodType<Prisma.InquiryUpdateManyWithoutSourceOrganizationNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUpdateManyWithoutSourceOrganizationNestedInput>;
export const InquiryUpdateManyWithoutSourceOrganizationNestedInputObjectZodSchema = makeSchema();
