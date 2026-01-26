import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema';
import { InquiryUpdateWithoutTargetUserInputObjectSchema as InquiryUpdateWithoutTargetUserInputObjectSchema } from './InquiryUpdateWithoutTargetUserInput.schema';
import { InquiryUncheckedUpdateWithoutTargetUserInputObjectSchema as InquiryUncheckedUpdateWithoutTargetUserInputObjectSchema } from './InquiryUncheckedUpdateWithoutTargetUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => InquiryWhereUniqueInputObjectSchema),
  data: z.union([z.lazy(() => InquiryUpdateWithoutTargetUserInputObjectSchema), z.lazy(() => InquiryUncheckedUpdateWithoutTargetUserInputObjectSchema)])
}).strict();
export const InquiryUpdateWithWhereUniqueWithoutTargetUserInputObjectSchema: z.ZodType<Prisma.InquiryUpdateWithWhereUniqueWithoutTargetUserInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUpdateWithWhereUniqueWithoutTargetUserInput>;
export const InquiryUpdateWithWhereUniqueWithoutTargetUserInputObjectZodSchema = makeSchema();
