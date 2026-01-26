import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema'

const makeSchema = () => z.object({
  organizationId: z.string(),
  model: WebhookModelSchema,
  url: z.string()
}).strict();
export const WebhookSubscriptionOrganizationIdModelUrlCompoundUniqueInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionOrganizationIdModelUrlCompoundUniqueInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionOrganizationIdModelUrlCompoundUniqueInput>;
export const WebhookSubscriptionOrganizationIdModelUrlCompoundUniqueInputObjectZodSchema = makeSchema();
