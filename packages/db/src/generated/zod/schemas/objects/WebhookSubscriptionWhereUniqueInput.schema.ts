import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionUserIdModelUrlCompoundUniqueInputObjectSchema as WebhookSubscriptionUserIdModelUrlCompoundUniqueInputObjectSchema } from './WebhookSubscriptionUserIdModelUrlCompoundUniqueInput.schema';
import { WebhookSubscriptionOrganizationIdModelUrlCompoundUniqueInputObjectSchema as WebhookSubscriptionOrganizationIdModelUrlCompoundUniqueInputObjectSchema } from './WebhookSubscriptionOrganizationIdModelUrlCompoundUniqueInput.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  userId_model_url: z.lazy(() => WebhookSubscriptionUserIdModelUrlCompoundUniqueInputObjectSchema).optional(),
  organizationId_model_url: z.lazy(() => WebhookSubscriptionOrganizationIdModelUrlCompoundUniqueInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionWhereUniqueInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionWhereUniqueInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionWhereUniqueInput>;
export const WebhookSubscriptionWhereUniqueInputObjectZodSchema = makeSchema();
