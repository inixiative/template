import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUserUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema as OrganizationUserUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema } from './OrganizationUserUncheckedCreateNestedManyWithoutOrganizationInput.schema';
import { WebhookSubscriptionUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema as WebhookSubscriptionUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionUncheckedCreateNestedManyWithoutOrganizationInput.schema';
import { InquiryUncheckedCreateNestedManyWithoutSourceOrganizationInputObjectSchema as InquiryUncheckedCreateNestedManyWithoutSourceOrganizationInputObjectSchema } from './InquiryUncheckedCreateNestedManyWithoutSourceOrganizationInput.schema';
import { InquiryUncheckedCreateNestedManyWithoutTargetOrganizationInputObjectSchema as InquiryUncheckedCreateNestedManyWithoutTargetOrganizationInputObjectSchema } from './InquiryUncheckedCreateNestedManyWithoutTargetOrganizationInput.schema'

const makeSchema = () => z.object({
  id: z.string().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  name: z.string(),
  slug: z.string(),
  users: z.lazy(() => OrganizationUserUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema).optional(),
  webhookSubscriptions: z.lazy(() => WebhookSubscriptionUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema).optional(),
  inquiriesSent: z.lazy(() => InquiryUncheckedCreateNestedManyWithoutSourceOrganizationInputObjectSchema).optional(),
  inquiriesReceived: z.lazy(() => InquiryUncheckedCreateNestedManyWithoutTargetOrganizationInputObjectSchema).optional()
}).strict();
export const OrganizationUncheckedCreateWithoutTokensInputObjectSchema: z.ZodType<Prisma.OrganizationUncheckedCreateWithoutTokensInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUncheckedCreateWithoutTokensInput>;
export const OrganizationUncheckedCreateWithoutTokensInputObjectZodSchema = makeSchema();
