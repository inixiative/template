import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { TokenCreateNestedManyWithoutOrganizationInputObjectSchema as TokenCreateNestedManyWithoutOrganizationInputObjectSchema } from './TokenCreateNestedManyWithoutOrganizationInput.schema';
import { WebhookSubscriptionCreateNestedManyWithoutOrganizationInputObjectSchema as WebhookSubscriptionCreateNestedManyWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionCreateNestedManyWithoutOrganizationInput.schema';
import { InquiryCreateNestedManyWithoutSourceOrganizationInputObjectSchema as InquiryCreateNestedManyWithoutSourceOrganizationInputObjectSchema } from './InquiryCreateNestedManyWithoutSourceOrganizationInput.schema';
import { InquiryCreateNestedManyWithoutTargetOrganizationInputObjectSchema as InquiryCreateNestedManyWithoutTargetOrganizationInputObjectSchema } from './InquiryCreateNestedManyWithoutTargetOrganizationInput.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  name: z.string(),
  slug: z.string(),
  tokens: z.lazy(() => TokenCreateNestedManyWithoutOrganizationInputObjectSchema).optional(),
  webhookSubscriptions: z.lazy(() => WebhookSubscriptionCreateNestedManyWithoutOrganizationInputObjectSchema).optional(),
  inquiriesSent: z.lazy(() => InquiryCreateNestedManyWithoutSourceOrganizationInputObjectSchema).optional(),
  inquiriesReceived: z.lazy(() => InquiryCreateNestedManyWithoutTargetOrganizationInputObjectSchema).optional()
}).strict();
export const OrganizationCreateWithoutOrganizationUsersInputObjectSchema: z.ZodType<Prisma.OrganizationCreateWithoutOrganizationUsersInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationCreateWithoutOrganizationUsersInput>;
export const OrganizationCreateWithoutOrganizationUsersInputObjectZodSchema = makeSchema();
