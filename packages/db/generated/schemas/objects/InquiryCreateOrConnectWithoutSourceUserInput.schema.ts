import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './InquiryWhereUniqueInput.schema';
import { InquiryCreateWithoutSourceUserInputObjectSchema as InquiryCreateWithoutSourceUserInputObjectSchema } from './InquiryCreateWithoutSourceUserInput.schema';
import { InquiryUncheckedCreateWithoutSourceUserInputObjectSchema as InquiryUncheckedCreateWithoutSourceUserInputObjectSchema } from './InquiryUncheckedCreateWithoutSourceUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => InquiryWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => InquiryCreateWithoutSourceUserInputObjectSchema), z.lazy(() => InquiryUncheckedCreateWithoutSourceUserInputObjectSchema)])
}).strict();
export const InquiryCreateOrConnectWithoutSourceUserInputObjectSchema: z.ZodType<Prisma.InquiryCreateOrConnectWithoutSourceUserInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryCreateOrConnectWithoutSourceUserInput>;
export const InquiryCreateOrConnectWithoutSourceUserInputObjectZodSchema = makeSchema();
