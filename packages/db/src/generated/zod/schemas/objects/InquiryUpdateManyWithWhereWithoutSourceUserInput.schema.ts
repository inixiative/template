import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryScalarWhereInputObjectSchema as InquiryScalarWhereInputObjectSchema } from './InquiryScalarWhereInput.schema';
import { InquiryUpdateManyMutationInputObjectSchema as InquiryUpdateManyMutationInputObjectSchema } from './InquiryUpdateManyMutationInput.schema';
import { InquiryUncheckedUpdateManyWithoutSourceUserInputObjectSchema as InquiryUncheckedUpdateManyWithoutSourceUserInputObjectSchema } from './InquiryUncheckedUpdateManyWithoutSourceUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => InquiryScalarWhereInputObjectSchema),
  data: z.union([z.lazy(() => InquiryUpdateManyMutationInputObjectSchema), z.lazy(() => InquiryUncheckedUpdateManyWithoutSourceUserInputObjectSchema)])
}).strict();
export const InquiryUpdateManyWithWhereWithoutSourceUserInputObjectSchema: z.ZodType<Prisma.InquiryUpdateManyWithWhereWithoutSourceUserInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUpdateManyWithWhereWithoutSourceUserInput>;
export const InquiryUpdateManyWithWhereWithoutSourceUserInputObjectZodSchema = makeSchema();
