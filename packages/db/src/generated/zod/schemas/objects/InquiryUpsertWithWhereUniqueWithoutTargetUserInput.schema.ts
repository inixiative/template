import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema';
import { InquiryUpdateWithoutTargetUserInputObjectSchema as InquiryUpdateWithoutTargetUserInputObjectSchema } from './InquiryUpdateWithoutTargetUserInput.schema';
import { InquiryUncheckedUpdateWithoutTargetUserInputObjectSchema as InquiryUncheckedUpdateWithoutTargetUserInputObjectSchema } from './InquiryUncheckedUpdateWithoutTargetUserInput.schema';
import { InquiryCreateWithoutTargetUserInputObjectSchema as InquiryCreateWithoutTargetUserInputObjectSchema } from './InquiryCreateWithoutTargetUserInput.schema';
import { InquiryUncheckedCreateWithoutTargetUserInputObjectSchema as InquiryUncheckedCreateWithoutTargetUserInputObjectSchema } from './InquiryUncheckedCreateWithoutTargetUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => InquiryWhereUniqueInputObjectSchema),
  update: z.union([z.lazy(() => InquiryUpdateWithoutTargetUserInputObjectSchema), z.lazy(() => InquiryUncheckedUpdateWithoutTargetUserInputObjectSchema)]),
  create: z.union([z.lazy(() => InquiryCreateWithoutTargetUserInputObjectSchema), z.lazy(() => InquiryUncheckedCreateWithoutTargetUserInputObjectSchema)])
}).strict();
export const InquiryUpsertWithWhereUniqueWithoutTargetUserInputObjectSchema: z.ZodType<Prisma.InquiryUpsertWithWhereUniqueWithoutTargetUserInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUpsertWithWhereUniqueWithoutTargetUserInput>;
export const InquiryUpsertWithWhereUniqueWithoutTargetUserInputObjectZodSchema = makeSchema();
