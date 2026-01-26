import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUserCreateNestedManyWithoutOrganizationInputObjectSchema as OrganizationUserCreateNestedManyWithoutOrganizationInputObjectSchema } from './OrganizationUserCreateNestedManyWithoutOrganizationInput.schema';
import { TokenCreateNestedManyWithoutOrganizationInputObjectSchema as TokenCreateNestedManyWithoutOrganizationInputObjectSchema } from './TokenCreateNestedManyWithoutOrganizationInput.schema';
import { WebhookSubscriptionCreateNestedManyWithoutOrganizationInputObjectSchema as WebhookSubscriptionCreateNestedManyWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionCreateNestedManyWithoutOrganizationInput.schema';
import { InquiryCreateNestedManyWithoutTargetOrganizationInputObjectSchema as InquiryCreateNestedManyWithoutTargetOrganizationInputObjectSchema } from './InquiryCreateNestedManyWithoutTargetOrganizationInput.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  name: z.string(),
  slug: z.string(),
  organizationUsers: z.lazy(() => OrganizationUserCreateNestedManyWithoutOrganizationInputObjectSchema).optional(),
  tokens: z.lazy(() => TokenCreateNestedManyWithoutOrganizationInputObjectSchema).optional(),
  webhookSubscriptions: z.lazy(() => WebhookSubscriptionCreateNestedManyWithoutOrganizationInputObjectSchema).optional(),
  inquiriesReceived: z.lazy(() => InquiryCreateNestedManyWithoutTargetOrganizationInputObjectSchema).optional()
}).strict();
export const OrganizationCreateWithoutInquiriesSentInputObjectSchema: z.ZodType<Prisma.OrganizationCreateWithoutInquiriesSentInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationCreateWithoutInquiriesSentInput>;
export const OrganizationCreateWithoutInquiriesSentInputObjectZodSchema = makeSchema();
