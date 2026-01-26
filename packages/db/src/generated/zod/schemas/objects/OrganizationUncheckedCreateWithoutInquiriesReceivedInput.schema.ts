import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUserUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema as OrganizationUserUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema } from './OrganizationUserUncheckedCreateNestedManyWithoutOrganizationInput.schema';
import { TokenUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema as TokenUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema } from './TokenUncheckedCreateNestedManyWithoutOrganizationInput.schema';
import { WebhookSubscriptionUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema as WebhookSubscriptionUncheckedCreateNestedManyWithoutOrganizationInputObjectSchema } from './WebhookSubscriptionUncheckedCreateNestedManyWithoutOrganizationInput.schema';
import { InquiryUncheckedCreateNestedManyWithoutSourceOrganizationInputObjectSchema as InquiryUncheckedCreateNestedManyWithoutSourceOrganizationInputObjectSchema } from './InquiryUncheckedCreateNestedManyWithoutSourceOrganizationInput.schema'

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
  inquiriesSent: z.lazy(() => InquiryUncheckedCreateNestedManyWithoutSourceOrganizationInputObjectSchema).optional()
}).strict();
export const OrganizationUncheckedCreateWithoutInquiriesReceivedInputObjectSchema: z.ZodType<Prisma.OrganizationUncheckedCreateWithoutInquiriesReceivedInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUncheckedCreateWithoutInquiriesReceivedInput>;
export const OrganizationUncheckedCreateWithoutInquiriesReceivedInputObjectZodSchema = makeSchema();
