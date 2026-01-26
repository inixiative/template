import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryScalarWhereInputObjectSchema as InquiryScalarWhereInputObjectSchema } from './InquiryScalarWhereInput.schema';
import { InquiryUpdateManyMutationInputObjectSchema as InquiryUpdateManyMutationInputObjectSchema } from './InquiryUpdateManyMutationInput.schema';
import { InquiryUncheckedUpdateManyWithoutSourceOrganizationInputObjectSchema as InquiryUncheckedUpdateManyWithoutSourceOrganizationInputObjectSchema } from './InquiryUncheckedUpdateManyWithoutSourceOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => InquiryScalarWhereInputObjectSchema),
  data: z.union([z.lazy(() => InquiryUpdateManyMutationInputObjectSchema), z.lazy(() => InquiryUncheckedUpdateManyWithoutSourceOrganizationInputObjectSchema)])
}).strict();
export const InquiryUpdateManyWithWhereWithoutSourceOrganizationInputObjectSchema: z.ZodType<Prisma.InquiryUpdateManyWithWhereWithoutSourceOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryUpdateManyWithWhereWithoutSourceOrganizationInput>;
export const InquiryUpdateManyWithWhereWithoutSourceOrganizationInputObjectZodSchema = makeSchema();
