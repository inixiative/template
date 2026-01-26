import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryCreateWithoutSourceUserInputObjectSchema as InquiryCreateWithoutSourceUserInputObjectSchema } from './InquiryCreateWithoutSourceUserInput.schema';
import { InquiryUncheckedCreateWithoutSourceUserInputObjectSchema as InquiryUncheckedCreateWithoutSourceUserInputObjectSchema } from './InquiryUncheckedCreateWithoutSourceUserInput.schema';
import { InquiryCreateOrConnectWithoutSourceUserInputObjectSchema as InquiryCreateOrConnectWithoutSourceUserInputObjectSchema } from './InquiryCreateOrConnectWithoutSourceUserInput.schema';
import { InquiryUpsertWithWhereUniqueWithoutSourceUserInputObjectSchema as InquiryUpsertWithWhereUniqueWithoutSourceUserInputObjectSchema } from './InquiryUpsertWithWhereUniqueWithoutSourceUserInput.schema';
import { InquiryCreateManySourceUserInputEnvelopeObjectSchema as InquiryCreateManySourceUserInputEnvelopeObjectSchema } from './InquiryCreateManySourceUserInputEnvelope.schema';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema';
import { InquiryUpdateWithWhereUniqueWithoutSourceUserInputObjectSchema as InquiryUpdateWithWhereUniqueWithoutSourceUserInputObjectSchema } from './InquiryUpdateWithWhereUniqueWithoutSourceUserInput.schema';
import { InquiryUpdateManyWithWhereWithoutSourceUserInputObjectSchema as InquiryUpdateManyWithWhereWithoutSourceUserInputObjectSchema } from './InquiryUpdateManyWithWhereWithoutSourceUserInput.schema';
import { InquiryScalarWhereInputObjectSchema as InquiryScalarWhereInputObjectSchema } from './InquiryScalarWhereInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => InquiryCreateWithoutSourceUserInputObjectSchema), z.lazy(() => InquiryCreateWithoutSourceUserInputObjectSchema).array(), z.lazy(() => InquiryUncheckedCreateWithoutSourceUserInputObjectSchema), z.lazy(() => InquiryUncheckedCreateWithoutSourceUserInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => InquiryCreateOrConnectWithoutSourceUserInputObjectSchema), z.lazy(() => InquiryCreateOrConnectWithoutSourceUserInputObjectSchema).array()]).optional(),
  upsert: z.union([z.lazy(() => InquiryUpsertWithWhereUniqueWithoutSourceUserInputObjectSchema), z.lazy(() => InquiryUpsertWithWhereUniqueWithoutSourceUserInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => InquiryCreateManySourceUserInputEnvelopeObjectSchema).optional(),
  set: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional(),
  disconnect: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional(),
  delete: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional(),
  connect: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional(),
  update: z.union([z.lazy(() => InquiryUpdateWithWhereUniqueWithoutSourceUserInputObjectSchema), z.lazy(() => InquiryUpdateWithWhereUniqueWithoutSourceUserInputObjectSchema).array()]).optional(),
  updateMany: z.union([z.lazy(() => InquiryUpdateManyWithWhereWithoutSourceUserInputObjectSchema), z.lazy(() => InquiryUpdateManyWithWhereWithoutSourceUserInputObjectSchema).array()]).optional(),
  deleteMany: z.union([z.lazy(() => InquiryScalarWhereInputObjectSchema), z.lazy(() => InquiryScalarWhereInputObjectSchema).array()]).optional()
}).strict();
export const InquiryUncheckedUpdateManyWithoutSourceUserNestedInputObjectSchema: z.ZodType<Prisma.InquiryUncheckedUpdateManyWithoutSourceUserNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUncheckedUpdateManyWithoutSourceUserNestedInput>;
export const InquiryUncheckedUpdateManyWithoutSourceUserNestedInputObjectZodSchema = makeSchema();
