import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryScalarWhereInputObjectSchema as InquiryScalarWhereInputObjectSchema } from './InquiryScalarWhereInput.schema';
import { InquiryUpdateManyMutationInputObjectSchema as InquiryUpdateManyMutationInputObjectSchema } from './InquiryUpdateManyMutationInput.schema';
import { InquiryUncheckedUpdateManyWithoutTargetUserInputObjectSchema as InquiryUncheckedUpdateManyWithoutTargetUserInputObjectSchema } from './InquiryUncheckedUpdateManyWithoutTargetUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => InquiryScalarWhereInputObjectSchema),
  data: z.union([z.lazy(() => InquiryUpdateManyMutationInputObjectSchema), z.lazy(() => InquiryUncheckedUpdateManyWithoutTargetUserInputObjectSchema)])
}).strict();
export const InquiryUpdateManyWithWhereWithoutTargetUserInputObjectSchema: z.ZodType<Prisma.InquiryUpdateManyWithWhereWithoutTargetUserInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUpdateManyWithWhereWithoutTargetUserInput>;
export const InquiryUpdateManyWithWhereWithoutTargetUserInputObjectZodSchema = makeSchema();
