import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './objects/WebhookSubscriptionWhereUniqueInput.schema';

export const WebhookSubscriptionFindUniqueOrThrowSchema: z.ZodType<Prisma.WebhookSubscriptionFindUniqueOrThrowArgs> = z.object({   where: WebhookSubscriptionWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionFindUniqueOrThrowArgs>;

export const WebhookSubscriptionFindUniqueOrThrowZodSchema = z.object({   where: WebhookSubscriptionWhereUniqueInputObjectSchema }).strict();