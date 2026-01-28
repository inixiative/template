import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookSubscriptionIncludeObjectSchema as WebhookSubscriptionIncludeObjectSchema } from './objects/WebhookSubscriptionInclude.schema';
import { WebhookSubscriptionOrderByWithRelationInputObjectSchema as WebhookSubscriptionOrderByWithRelationInputObjectSchema } from './objects/WebhookSubscriptionOrderByWithRelationInput.schema';
import { WebhookSubscriptionWhereInputObjectSchema as WebhookSubscriptionWhereInputObjectSchema } from './objects/WebhookSubscriptionWhereInput.schema';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './objects/WebhookSubscriptionWhereUniqueInput.schema';
import { WebhookSubscriptionScalarFieldEnumSchema } from './enums/WebhookSubscriptionScalarFieldEnum.schema';

// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const WebhookSubscriptionFindFirstSelectSchema: z.ZodType<Prisma.WebhookSubscriptionSelect> = z.object({
    id: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    model: z.boolean().optional(),
    url: z.boolean().optional(),
    isActive: z.boolean().optional(),
    ownerModel: z.boolean().optional(),
    userId: z.boolean().optional(),
    organizationId: z.boolean().optional(),
    user: z.boolean().optional(),
    organization: z.boolean().optional(),
    webhookEvents: z.boolean().optional(),
    _count: z.boolean().optional()
  }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionSelect>;

export const WebhookSubscriptionFindFirstSelectZodSchema = z.object({
    id: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    model: z.boolean().optional(),
    url: z.boolean().optional(),
    isActive: z.boolean().optional(),
    ownerModel: z.boolean().optional(),
    userId: z.boolean().optional(),
    organizationId: z.boolean().optional(),
    user: z.boolean().optional(),
    organization: z.boolean().optional(),
    webhookEvents: z.boolean().optional(),
    _count: z.boolean().optional()
  }).strict();

export const WebhookSubscriptionFindFirstSchema: z.ZodType<Prisma.WebhookSubscriptionFindFirstArgs> = z.object({ select: WebhookSubscriptionFindFirstSelectSchema.optional(), include: z.lazy(() => WebhookSubscriptionIncludeObjectSchema.optional()), orderBy: z.union([WebhookSubscriptionOrderByWithRelationInputObjectSchema, WebhookSubscriptionOrderByWithRelationInputObjectSchema.array()]).optional(), where: WebhookSubscriptionWhereInputObjectSchema.optional(), cursor: WebhookSubscriptionWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([WebhookSubscriptionScalarFieldEnumSchema, WebhookSubscriptionScalarFieldEnumSchema.array()]).optional() }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionFindFirstArgs>;

export const WebhookSubscriptionFindFirstZodSchema = z.object({ select: WebhookSubscriptionFindFirstSelectSchema.optional(), include: z.lazy(() => WebhookSubscriptionIncludeObjectSchema.optional()), orderBy: z.union([WebhookSubscriptionOrderByWithRelationInputObjectSchema, WebhookSubscriptionOrderByWithRelationInputObjectSchema.array()]).optional(), where: WebhookSubscriptionWhereInputObjectSchema.optional(), cursor: WebhookSubscriptionWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([WebhookSubscriptionScalarFieldEnumSchema, WebhookSubscriptionScalarFieldEnumSchema.array()]).optional() }).strict();