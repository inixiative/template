import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookEventIncludeObjectSchema as WebhookEventIncludeObjectSchema } from './objects/WebhookEventInclude.schema';
import { WebhookEventOrderByWithRelationInputObjectSchema as WebhookEventOrderByWithRelationInputObjectSchema } from './objects/WebhookEventOrderByWithRelationInput.schema';
import { WebhookEventWhereInputObjectSchema as WebhookEventWhereInputObjectSchema } from './objects/WebhookEventWhereInput.schema';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './objects/WebhookEventWhereUniqueInput.schema';
import { WebhookEventScalarFieldEnumSchema } from './enums/WebhookEventScalarFieldEnum.schema';

// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const WebhookEventFindManySelectSchema: z.ZodType<Prisma.WebhookEventSelect> = z.object({
    id: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    status: z.boolean().optional(),
    action: z.boolean().optional(),
    payload: z.boolean().optional(),
    error: z.boolean().optional(),
    webhookSubscriptionId: z.boolean().optional(),
    webhookSubscription: z.boolean().optional(),
    resourceId: z.boolean().optional()
  }).strict() as unknown as z.ZodType<Prisma.WebhookEventSelect>;

export const WebhookEventFindManySelectZodSchema = z.object({
    id: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    status: z.boolean().optional(),
    action: z.boolean().optional(),
    payload: z.boolean().optional(),
    error: z.boolean().optional(),
    webhookSubscriptionId: z.boolean().optional(),
    webhookSubscription: z.boolean().optional(),
    resourceId: z.boolean().optional()
  }).strict();

export const WebhookEventFindManySchema: z.ZodType<Prisma.WebhookEventFindManyArgs> = z.object({ select: WebhookEventFindManySelectSchema.optional(), include: z.lazy(() => WebhookEventIncludeObjectSchema.optional()), orderBy: z.union([WebhookEventOrderByWithRelationInputObjectSchema, WebhookEventOrderByWithRelationInputObjectSchema.array()]).optional(), where: WebhookEventWhereInputObjectSchema.optional(), cursor: WebhookEventWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([WebhookEventScalarFieldEnumSchema, WebhookEventScalarFieldEnumSchema.array()]).optional() }).strict() as unknown as z.ZodType<Prisma.WebhookEventFindManyArgs>;

export const WebhookEventFindManyZodSchema = z.object({ select: WebhookEventFindManySelectSchema.optional(), include: z.lazy(() => WebhookEventIncludeObjectSchema.optional()), orderBy: z.union([WebhookEventOrderByWithRelationInputObjectSchema, WebhookEventOrderByWithRelationInputObjectSchema.array()]).optional(), where: WebhookEventWhereInputObjectSchema.optional(), cursor: WebhookEventWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([WebhookEventScalarFieldEnumSchema, WebhookEventScalarFieldEnumSchema.array()]).optional() }).strict();