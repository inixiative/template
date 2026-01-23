import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookSubscriptionOrderByWithRelationInputObjectSchema as WebhookSubscriptionOrderByWithRelationInputObjectSchema } from './objects/WebhookSubscriptionOrderByWithRelationInput.schema';
import { WebhookSubscriptionWhereInputObjectSchema as WebhookSubscriptionWhereInputObjectSchema } from './objects/WebhookSubscriptionWhereInput.schema';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './objects/WebhookSubscriptionWhereUniqueInput.schema';
import { WebhookSubscriptionScalarFieldEnumSchema } from './enums/WebhookSubscriptionScalarFieldEnum.schema';

// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const WebhookSubscriptionFindFirstOrThrowSelectSchema: z.ZodType<Prisma.WebhookSubscriptionSelect> = z.object({
    id: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    model: z.boolean().optional(),
    url: z.boolean().optional(),
    secret: z.boolean().optional(),
    isActive: z.boolean().optional(),
    ownerType: z.boolean().optional(),
    ownerId: z.boolean().optional(),
    events: z.boolean().optional(),
    _count: z.boolean().optional()
  }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionSelect>;

export const WebhookSubscriptionFindFirstOrThrowSelectZodSchema = z.object({
    id: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    model: z.boolean().optional(),
    url: z.boolean().optional(),
    secret: z.boolean().optional(),
    isActive: z.boolean().optional(),
    ownerType: z.boolean().optional(),
    ownerId: z.boolean().optional(),
    events: z.boolean().optional(),
    _count: z.boolean().optional()
  }).strict();

export const WebhookSubscriptionFindFirstOrThrowSchema: z.ZodType<Prisma.WebhookSubscriptionFindFirstOrThrowArgs> = z.object({ select: WebhookSubscriptionFindFirstOrThrowSelectSchema.optional(),  orderBy: z.union([WebhookSubscriptionOrderByWithRelationInputObjectSchema, WebhookSubscriptionOrderByWithRelationInputObjectSchema.array()]).optional(), where: WebhookSubscriptionWhereInputObjectSchema.optional(), cursor: WebhookSubscriptionWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([WebhookSubscriptionScalarFieldEnumSchema, WebhookSubscriptionScalarFieldEnumSchema.array()]).optional() }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionFindFirstOrThrowArgs>;

export const WebhookSubscriptionFindFirstOrThrowZodSchema = z.object({ select: WebhookSubscriptionFindFirstOrThrowSelectSchema.optional(),  orderBy: z.union([WebhookSubscriptionOrderByWithRelationInputObjectSchema, WebhookSubscriptionOrderByWithRelationInputObjectSchema.array()]).optional(), where: WebhookSubscriptionWhereInputObjectSchema.optional(), cursor: WebhookSubscriptionWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([WebhookSubscriptionScalarFieldEnumSchema, WebhookSubscriptionScalarFieldEnumSchema.array()]).optional() }).strict();