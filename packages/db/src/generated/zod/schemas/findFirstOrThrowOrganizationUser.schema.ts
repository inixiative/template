import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { OrganizationUserIncludeObjectSchema as OrganizationUserIncludeObjectSchema } from './objects/OrganizationUserInclude.schema';
import { OrganizationUserOrderByWithRelationInputObjectSchema as OrganizationUserOrderByWithRelationInputObjectSchema } from './objects/OrganizationUserOrderByWithRelationInput.schema';
import { OrganizationUserWhereInputObjectSchema as OrganizationUserWhereInputObjectSchema } from './objects/OrganizationUserWhereInput.schema';
import { OrganizationUserWhereUniqueInputObjectSchema as OrganizationUserWhereUniqueInputObjectSchema } from './objects/OrganizationUserWhereUniqueInput.schema';
import { OrganizationUserScalarFieldEnumSchema } from './enums/OrganizationUserScalarFieldEnum.schema';

// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const OrganizationUserFindFirstOrThrowSelectSchema: z.ZodType<Prisma.OrganizationUserSelect> = z.object({
    id: z.boolean().optional(),
    organizationId: z.boolean().optional(),
    userId: z.boolean().optional(),
    role: z.boolean().optional(),
    entitlements: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    organization: z.boolean().optional(),
    user: z.boolean().optional(),
    tokens: z.boolean().optional(),
    _count: z.boolean().optional()
  }).strict() as unknown as z.ZodType<Prisma.OrganizationUserSelect>;

export const OrganizationUserFindFirstOrThrowSelectZodSchema = z.object({
    id: z.boolean().optional(),
    organizationId: z.boolean().optional(),
    userId: z.boolean().optional(),
    role: z.boolean().optional(),
    entitlements: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    organization: z.boolean().optional(),
    user: z.boolean().optional(),
    tokens: z.boolean().optional(),
    _count: z.boolean().optional()
  }).strict();

export const OrganizationUserFindFirstOrThrowSchema: z.ZodType<Prisma.OrganizationUserFindFirstOrThrowArgs> = z.object({ select: OrganizationUserFindFirstOrThrowSelectSchema.optional(), include: z.lazy(() => OrganizationUserIncludeObjectSchema.optional()), orderBy: z.union([OrganizationUserOrderByWithRelationInputObjectSchema, OrganizationUserOrderByWithRelationInputObjectSchema.array()]).optional(), where: OrganizationUserWhereInputObjectSchema.optional(), cursor: OrganizationUserWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([OrganizationUserScalarFieldEnumSchema, OrganizationUserScalarFieldEnumSchema.array()]).optional() }).strict() as unknown as z.ZodType<Prisma.OrganizationUserFindFirstOrThrowArgs>;

export const OrganizationUserFindFirstOrThrowZodSchema = z.object({ select: OrganizationUserFindFirstOrThrowSelectSchema.optional(), include: z.lazy(() => OrganizationUserIncludeObjectSchema.optional()), orderBy: z.union([OrganizationUserOrderByWithRelationInputObjectSchema, OrganizationUserOrderByWithRelationInputObjectSchema.array()]).optional(), where: OrganizationUserWhereInputObjectSchema.optional(), cursor: OrganizationUserWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([OrganizationUserScalarFieldEnumSchema, OrganizationUserScalarFieldEnumSchema.array()]).optional() }).strict();