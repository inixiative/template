import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUserUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema as OrganizationUserUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema } from './OrganizationUserUncheckedCreateNestedManyWithoutOrganizationInput.schema';
import { TokenUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema as TokenUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema } from './TokenUncheckedCreateNestedManyWithoutOrganizationInput.schema';
import { WebhookSubscriptionUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema as WebhookSubscriptionUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionUncheckedCreateNestedManyWithoutOrganizationInput.schema';
import { InquiryUncheckedCreateNestedManyWithoutTargetOrganizationInputObjectSchema as InquiryUncheckedCreateNestedManyWithoutTargetOrganizationInputObjectSchema } from './InquiryUncheckedCreateNestedManyWithoutTargetOrganizationInput.schema'

const makeSchema = () => z.object({
  id: z.string().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  name: z.string(),
  slug: z.string(),
  organizationUsers: z.lazy(() => OrganizationUserUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema).optional(),
  tokens: z.lazy(() => TokenUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema).optional(),
  webhookSubscriptions: z.lazy(() => WebhookSubscriptionUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema).optional(),
  inquiriesReceived: z.lazy(() => InquiryUncheckedCreateNestedManyWithoutTargetOrganizationInputObjectSchema).optional()
}).strict();
export const OrganizationUncheckedCreateWithoutInquiriesSentInputObjectSchema: z.ZodType<Prisma.OrganizationUncheckedCreateWithoutInquiriesSentInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUncheckedCreateWithoutInquiriesSentInput>;
export const OrganizationUncheckedCreateWithoutInquiriesSentInputObjectZodSchema = makeSchema();
