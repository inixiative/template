import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema';
import { InquiryUpdateWithoutSourceUserInputObjectSchema as InquiryUpdateWithoutSourceUserInputObjectSchema } from './InquiryUpdateWithoutSourceUserInput.schema';
import { InquiryUncheckedUpdateWithoutSourceUserInputObjectSchema as InquiryUncheckedUpdateWithoutSourceUserInputObjectSchema } from './InquiryUncheckedUpdateWithoutSourceUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => InquiryWhereUniqueInputObjectSchema),
  data: z.union([z.lazy(() => InquiryUpdateWithoutSourceUserInputObjectSchema), z.lazy(() => InquiryUncheckedUpdateWithoutSourceUserInputObjectSchema)])
}).strict();
export const InquiryUpdateWithWhereUniqueWithoutSourceUserInputObjectSchema: z.ZodType<Prisma.InquiryUpdateWithWhereUniqueWithoutSourceUserInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUpdateWithWhereUniqueWithoutSourceUserInput>;
export const InquiryUpdateWithWhereUniqueWithoutSourceUserInputObjectZodSchema = makeSchema();
