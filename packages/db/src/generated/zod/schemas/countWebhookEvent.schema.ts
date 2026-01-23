import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookEventOrderByWithRelationInputObjectSchema as WebhookEventOrderByWithRelationInputObjectSchema } from './objects/WebhookEventOrderByWithRelationInput.schema';
import { WebhookEventWhereInputObjectSchema as WebhookEventWhereInputObjectSchema } from './objects/WebhookEventWhereInput.schema';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './objects/WebhookEventWhereUniqueInput.schema';
import { WebhookEventCountAggregateInputObjectSchema as WebhookEventCountAggregateInputObjectSchema } from './objects/WebhookEventCountAggregateInput.schema';

export const WebhookEventCountSchema: z.ZodType<Prisma.WebhookEventCountArgs> = z.object({ orderBy: z.union([WebhookEventOrderByWithRelationInputObjectSchema, WebhookEventOrderByWithRelationInputObjectSchema.array()]).optional(), where: WebhookEventWhereInputObjectSchema.optional(), cursor: WebhookEventWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), select: z.union([ z.literal(true), WebhookEventCountAggregateInputObjectSchema ]).optional() }).strict() as unknown as z.ZodType<Prisma.WebhookEventCountArgs>;

export const WebhookEventCountZodSchema = z.object({ orderBy: z.union([WebhookEventOrderByWithRelationInputObjectSchema, WebhookEventOrderByWithRelationInputObjectSchema.array()]).optional(), where: WebhookEventWhereInputObjectSchema.optional(), cursor: WebhookEventWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), select: z.union([ z.literal(true), WebhookEventCountAggregateInputObjectSchema ]).optional() }).strict();