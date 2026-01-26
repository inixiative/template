import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema';
import { InquiryUpdateWithoutSourceUserInputObjectSchema as InquiryUpdateWithoutSourceUserInputObjectSchema } from './InquiryUpdateWithoutSourceUserInput.schema';
import { InquiryUncheckedUpdateWithoutSourceUserInputObjectSchema as InquiryUncheckedUpdateWithoutSourceUserInputObjectSchema } from './InquiryUncheckedUpdateWithoutSourceUserInput.schema';
import { InquiryCreateWithoutSourceUserInputObjectSchema as InquiryCreateWithoutSourceUserInputObjectSchema } from './InquiryCreateWithoutSourceUserInput.schema';
import { InquiryUncheckedCreateWithoutSourceUserInputObjectSchema as InquiryUncheckedCreateWithoutSourceUserInputObjectSchema } from './InquiryUncheckedCreateWithoutSourceUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => InquiryWhereUniqueInputObjectSchema),
  update: z.union([z.lazy(() => InquiryUpdateWithoutSourceUserInputObjectSchema), z.lazy(() => InquiryUncheckedUpdateWithoutSourceUserInputObjectSchema)]),
  create: z.union([z.lazy(() => InquiryCreateWithoutSourceUserInputObjectSchema), z.lazy(() => InquiryUncheckedCreateWithoutSourceUserInputObjectSchema)])
}).strict();
export const InquiryUpsertWithWhereUniqueWithoutSourceUserInputObjectSchema: z.ZodType<Prisma.InquiryUpsertWithWhereUniqueWithoutSourceUserInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUpsertWithWhereUniqueWithoutSourceUserInput>;
export const InquiryUpsertWithWhereUniqueWithoutSourceUserInputObjectZodSchema = makeSchema();
