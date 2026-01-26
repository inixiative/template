import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryScalarWhereInputObjectSchema as InquiryScalarWhereInputObjectSchema } from './InquiryScalarWhereInput.schema';
import { InquiryUpdateManyMutationInputObjectSchema as InquiryUpdateManyMutationInputObjectSchema } from './InquiryUpdateManyMutationInput.schema';
import { InquiryUncheckedUpdateManyWithoutTargetOrganizationInputObjectSchema as InquiryUncheckedUpdateManyWithoutTargetOrganizationInputObjectSchema } from './InquiryUncheckedUpdateManyWithoutTargetOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => InquiryScalarWhereInputObjectSchema),
  data: z.union([z.lazy(() => InquiryUpdateManyMutationInputObjectSchema), z.lazy(() => InquiryUncheckedUpdateManyWithoutTargetOrganizationInputObjectSchema)])
}).strict();
export const InquiryUpdateManyWithWhereWithoutTargetOrganizationInputObjectSchema: z.ZodType<Prisma.InquiryUpdateManyWithWhereWithoutTargetOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUpdateManyWithWhereWithoutTargetOrganizationInput>;
export const InquiryUpdateManyWithWhereWithoutTargetOrganizationInputObjectZodSchema = makeSchema();
