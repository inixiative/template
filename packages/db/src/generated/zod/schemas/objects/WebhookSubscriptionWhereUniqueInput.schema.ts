import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookSubscriptionOwnerIdModelUrlCompoundUniqueInputObjectSchema as WebhookSubscriptionOwnerIdModelUrlCompoundUniqueInputObjectSchema } from './WebhookSubscriptionOwnerIdModelUrlCompoundUniqueInput.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  ownerId_model_url: z.lazy(() => WebhookSubscriptionOwnerIdModelUrlCompoundUniqueInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionWhereUniqueInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionWhereUniqueInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionWhereUniqueInput>;
export const WebhookSubscriptionWhereUniqueInputObjectZodSchema = makeSchema();
