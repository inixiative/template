import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryCreateWithoutSourceUserInputObjectSchema as InquiryCreateWithoutSourceUserInputObjectSchema } from './InquiryCreateWithoutSourceUserInput.schema';
import { InquiryUncheckedCreateWithoutSourceUserInputObjectSchema as InquiryUncheckedCreateWithoutSourceUserInputObjectSchema } from './InquiryUncheckedCreateWithoutSourceUserInput.schema';
import { InquiryCreateOrConnectWithoutSourceUserInputObjectSchema as InquiryCreateOrConnectWithoutSourceUserInputObjectSchema } from './InquiryCreateOrConnectWithoutSourceUserInput.schema';
import { InquiryCreateManySourceUserInputEnvelopeObjectSchema as InquiryCreateManySourceUserInputEnvelopeObjectSchema } from './InquiryCreateManySourceUserInputEnvelope.schema';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => InquiryCreateWithoutSourceUserInputObjectSchema), z.lazy(() => InquiryCreateWithoutSourceUserInputObjectSchema).array(), z.lazy(() => InquiryUncheckedCreateWithoutSourceUserInputObjectSchema), z.lazy(() => InquiryUncheckedCreateWithoutSourceUserInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => InquiryCreateOrConnectWithoutSourceUserInputObjectSchema), z.lazy(() => InquiryCreateOrConnectWithoutSourceUserInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => InquiryCreateManySourceUserInputEnvelopeObjectSchema).optional(),
  connect: z.union([z.lazy(() => InquiryWhereUniqueInputObjectSchema), z.lazy(() => InquiryWhereUniqueInputObjectSchema).array()]).optional()
}).strict();
export const InquiryUncheckedCreateNestedManyWithoutSourceUserInputObjectSchema: z.ZodType<Prisma.InquiryUncheckedCreateNestedManyWithoutSourceUserInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUncheckedCreateNestedManyWithoutSourceUserInput>;
export const InquiryUncheckedCreateNestedManyWithoutSourceUserInputObjectZodSchema = makeSchema();
