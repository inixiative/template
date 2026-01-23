import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './objects/WebhookSubscriptionWhereUniqueInput.schema';

export const WebhookSubscriptionFindUniqueSchema: z.ZodType<Prisma.WebhookSubscriptionFindUniqueArgs> = z.object({   where: WebhookSubscriptionWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionFindUniqueArgs>;

export const WebhookSubscriptionFindUniqueZodSchema = z.object({   where: WebhookSubscriptionWhereUniqueInputObjectSchema }).strict();