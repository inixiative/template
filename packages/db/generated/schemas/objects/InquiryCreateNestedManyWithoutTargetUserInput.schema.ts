import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryCreateWithoutTargetUserInputObjectSchema as InquiryCreateWithoutTargetUserInputObjectSchema } from './InquiryCreateWithoutTargetUserInput.schema';
import { InquiryUncheckedCreateWithoutTargetUserInputObjectSchema as InquiryUncheckedCreateWithoutTargetUserInputObjectSchema } from './InquiryUncheckedCreateWithoutTargetUserInput.schema';
import { InquiryCreateOrConnectWithoutTargetUserInputObjectSchema as InquiryCreateOrConnectWithoutTargetUserInputObjectSchema } from './InquiryCreateOrConnectWithoutTargetUserInput.schema';
import { InquiryCreateManyTargetUserInputEnvelopeObjectSchema as InquiryCreateManyTargetUserInputEnvelopeObjectSchema } from './InquiryCreateManyTargetUserInputEnvelope.schema';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => InquiryCreateWithoutTargetUserInputObjectSchema), z.lazy(() => InquiryCreateWithoutTargetUserInputObjectSchema).array(), z.lazy(() => InquiryUncheckedCreateWithoutTargetUserInputObjectSchema), z.lazy(() => InquiryUncheckedCreateWithoutTargetUserInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => InquiryCreateOrConnectWithoutTargetUserInputObjectSchema), z.lazy(() => InquiryCreateOrConnectWithoutTargetUserInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => InquiryCreateManyTargetUserInputEnvelopeObjectSchema).optional(),
  connect: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional()
}).strict();
export const InquiryCreateNestedManyWithoutTargetUserInputObjectSchema: z.ZodType<Prisma.InquiryCreateNestedManyWithoutTargetUserInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryCreateNestedManyWithoutTargetUserInput>;
export const InquiryCreateNestedManyWithoutTargetUserInputObjectZodSchema = makeSchema();
