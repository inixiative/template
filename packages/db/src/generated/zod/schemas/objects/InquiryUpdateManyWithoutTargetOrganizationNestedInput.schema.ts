import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryCreateWithoutTargetOrganizationInputObjectSchema as InquiryCreateWithoutTargetOrganizationInputObjectSchema } from './InquiryCreateWithoutTargetOrganizationInput.schema';
import { InquiryUncheckedCreateWithoutTargetOrganizationInputObjectSchema as InquiryUncheckedCreateWithoutTargetOrganizationInputObjectSchema } from './InquiryUncheckedCreateWithoutTargetOrganizationInput.schema';
import { InquiryCreateOrConnectWithoutTargetOrganizationInputObjectSchema as InquiryCreateOrConnectWithoutTargetOrganizationInputObjectSchema } from './InquiryCreateOrConnectWithoutTargetOrganizationInput.schema';
import { InquiryUpsertWithWhereUniqueWithoutTargetOrganizationInputObjectSchema as InquiryUpsertWithWhereUniqueWithoutTargetOrganizationInputObjectSchema } from './InquiryUpsertWithWhereUniqueWithoutTargetOrganizationInput.schema';
import { InquiryCreateManyTargetOrganizationInputEnvelopeObjectSchema as InquiryCreateManyTargetOrganizationInputEnvelopeObjectSchema } from './InquiryCreateManyTargetOrganizationInputEnvelope.schema';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema';
import { InquiryUpdateWithWhereUniqueWithoutTargetOrganizationInputObjectSchema as InquiryUpdateWithWhereUniqueWithoutTargetOrganizationInputObjectSchema } from './InquiryUpdateWithWhereUniqueWithoutTargetOrganizationInput.schema';
import { InquiryUpdateManyWithWhereWithoutTargetOrganizationInputObjectSchema as InquiryUpdateManyWithWhereWithoutTargetOrganizationInputObjectSchema } from './InquiryUpdateManyWithWhereWithoutTargetOrganizationInput.schema';
import { InquiryScalarWhereInputObjectSchema as InquiryScalarWhereInputObjectSchema } from './InquiryScalarWhereInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => InquiryCreateWithoutTargetOrganizationInputObjectSchema), z.lazy(() => InquiryCreateWithoutTargetOrganizationInputObjectSchema).array(), z.lazy(() => InquiryUncheckedCreateWithoutTargetOrganizationInputObjectSchema), z.lazy(() => InquiryUncheckedCreateWithoutTargetOrganizationInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => InquiryCreateOrConnectWithoutTargetOrganizationInputObjectSchema), z.lazy(() => InquiryCreateOrConnectWithoutTargetOrganizationInputObjectSchema).array()]).optional(),
  upsert: z.union([z.lazy(() => InquiryUpsertWithWhereUniqueWithoutTargetOrganizationInputObjectSchema), z.lazy(() => InquiryUpsertWithWhereUniqueWithoutTargetOrganizationInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => InquiryCreateManyTargetOrganizationInputEnvelopeObjectSchema).optional(),
  set: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional(),
  disconnect: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional(),
  delete: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional(),
  connect: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional(),
  update: z.union([z.lazy(() => InquiryUpdateWithWhereUniqueWithoutTargetOrganizationInputObjectSchema), z.lazy(() => InquiryUpdateWithWhereUniqueWithoutTargetOrganizationInputObjectSchema).array()]).optional(),
  updateMany: z.union([z.lazy(() => InquiryUpdateManyWithWhereWithoutTargetOrganizationInputObjectSchema), z.lazy(() => InquiryUpdateManyWithWhereWithoutTargetOrganizationInputObjectSchema).array()]).optional(),
  deleteMany: z.union([z.lazy(() => InquiryScalarWhereInputObjectSchema), z.lazy(() => InquiryScalarWhereInputObjectSchema).array()]).optional()
}).strict();
export const InquiryUpdateManyWithoutTargetOrganizationNestedInputObjectSchema: z.ZodType<Prisma.InquiryUpdateManyWithoutTargetOrganizationNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUpdateManyWithoutTargetOrganizationNestedInput>;
export const InquiryUpdateManyWithoutTargetOrganizationNestedInputObjectZodSchema = makeSchema();
