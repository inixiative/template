import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryCreateWithoutTargetUserInputObjectSchema as InquiryCreateWithoutTargetUserInputObjectSchema } from './InquiryCreateWithoutTargetUserInput.schema';
import { InquiryUncheckedCreateWithoutTargetUserInputObjectSchema as InquiryUncheckedCreateWithoutTargetUserInputObjectSchema } from './InquiryUncheckedCreateWithoutTargetUserInput.schema';
import { InquiryCreateOrConnectWithoutTargetUserInputObjectSchema as InquiryCreateOrConnectWithoutTargetUserInputObjectSchema } from './InquiryCreateOrConnectWithoutTargetUserInput.schema';
import { InquiryUpsertWithWhereUniqueWithoutTargetUserInputObjectSchema as InquiryUpsertWithWhereUniqueWithoutTargetUserInputObjectSchema } from './InquiryUpsertWithWhereUniqueWithoutTargetUserInput.schema';
import { InquiryCreateManyTargetUserInputEnvelopeObjectSchema as InquiryCreateManyTargetUserInputEnvelopeObjectSchema } from './InquiryCreateManyTargetUserInputEnvelope.schema';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema';
import { InquiryUpdateWithWhereUniqueWithoutTargetUserInputObjectSchema as InquiryUpdateWithWhereUniqueWithoutTargetUserInputObjectSchema } from './InquiryUpdateWithWhereUniqueWithoutTargetUserInput.schema';
import { InquiryUpdateManyWithWhereWithoutTargetUserInputObjectSchema as InquiryUpdateManyWithWhereWithoutTargetUserInputObjectSchema } from './InquiryUpdateManyWithWhereWithoutTargetUserInput.schema';
import { InquiryScalarWhereInputObjectSchema as InquiryScalarWhereInputObjectSchema } from './InquiryScalarWhereInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => InquiryCreateWithoutTargetUserInputObjectSchema), z.lazy(() => InquiryCreateWithoutTargetUserInputObjectSchema).array(), z.lazy(() => InquiryUncheckedCreateWithoutTargetUserInputObjectSchema), z.lazy(() => InquiryUncheckedCreateWithoutTargetUserInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => InquiryCreateOrConnectWithoutTargetUserInputObjectSchema), z.lazy(() => InquiryCreateOrConnectWithoutTargetUserInputObjectSchema).array()]).optional(),
  upsert: z.union([z.lazy(() => InquiryUpsertWithWhereUniqueWithoutTargetUserInputObjectSchema), z.lazy(() => InquiryUpsertWithWhereUniqueWithoutTargetUserInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => InquiryCreateManyTargetUserInputEnvelopeObjectSchema).optional(),
  set: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional(),
  disconnect: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional(),
  delete: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional(),
  connect: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional(),
  update: z.union([z.lazy(() => InquiryUpdateWithWhereUniqueWithoutTargetUserInputObjectSchema), z.lazy(() => InquiryUpdateWithWhereUniqueWithoutTargetUserInputObjectSchema).array()]).optional(),
  updateMany: z.union([z.lazy(() => InquiryUpdateManyWithWhereWithoutTargetUserInputObjectSchema), z.lazy(() => InquiryUpdateManyWithWhereWithoutTargetUserInputObjectSchema).array()]).optional(),
  deleteMany: z.union([z.lazy(() => InquiryScalarWhereInputObjectSchema), z.lazy(() => InquiryScalarWhereInputObjectSchema).array()]).optional()
}).strict();
export const InquiryUpdateManyWithoutTargetUserNestedInputObjectSchema: z.ZodType<Prisma.InquiryUpdateManyWithoutTargetUserNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUpdateManyWithoutTargetUserNestedInput>;
export const InquiryUpdateManyWithoutTargetUserNestedInputObjectZodSchema = makeSchema();
