import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { InquiryIncludeObjectSchema as InquiryIncludeObjectSchema } from './objects/InquiryInclude.schema';
import { InquiryOrderByWithRelationInputObjectSchema as InquiryOrderByWithRelationInputObjectSchema } from './objects/InquiryOrderByWithRelationInput.schema';
import { InquiryWhereInputObjectSchema as InquiryWhereInputObjectSchema } from './objects/InquiryWhereInput.schema';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './objects/InquiryWhereUniqueInput.schema';
import { InquiryScalarFieldEnumSchema } from './enums/InquiryScalarFieldEnum.schema';

// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const InquiryFindFirstOrThrowSelectSchema: z.ZodType<Prisma.InquirySelect> = z.object({
    id: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    sentAt: z.boolean().optional(),
    type: z.boolean().optional(),
    status: z.boolean().optional(),
    content: z.boolean().optional(),
    resolution: z.boolean().optional(),
    sourceModel: z.boolean().optional(),
    sourceUserId: z.boolean().optional(),
    sourceOrganizationId: z.boolean().optional(),
    sourceUser: z.boolean().optional(),
    sourceOrganization: z.boolean().optional(),
    targetModel: z.boolean().optional(),
    targetUserId: z.boolean().optional(),
    targetOrganizationId: z.boolean().optional(),
    targetUser: z.boolean().optional(),
    targetOrganization: z.boolean().optional()
  }).strict() as unknown as z.ZodType<Prisma.InquirySelect>;

export const InquiryFindFirstOrThrowSelectZodSchema = z.object({
    id: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    sentAt: z.boolean().optional(),
    type: z.boolean().optional(),
    status: z.boolean().optional(),
    content: z.boolean().optional(),
    resolution: z.boolean().optional(),
    sourceModel: z.boolean().optional(),
    sourceUserId: z.boolean().optional(),
    sourceOrganizationId: z.boolean().optional(),
    sourceUser: z.boolean().optional(),
    sourceOrganization: z.boolean().optional(),
    targetModel: z.boolean().optional(),
    targetUserId: z.boolean().optional(),
    targetOrganizationId: z.boolean().optional(),
    targetUser: z.boolean().optional(),
    targetOrganization: z.boolean().optional()
  }).strict();

export const InquiryFindFirstOrThrowSchema: z.ZodType<Prisma.InquiryFindFirstOrThrowArgs> = z.object({ select: InquiryFindFirstOrThrowSelectSchema.optional(), include: z.lazy(() => InquiryIncludeObjectSchema.optional()), orderBy: z.union([InquiryOrderByWithRelationInputObjectSchema, InquiryOrderByWithRelationInputObjectSchema.array()]).optional(), where: InquiryWhereInputObjectSchema.optional(), cursor: InquiryWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([InquiryScalarFieldEnumSchema, InquiryScalarFieldEnumSchema.array()]).optional() }).strict() as unknown as z.ZodType<Prisma.InquiryFindFirstOrThrowArgs>;

export const InquiryFindFirstOrThrowZodSchema = z.object({ select: InquiryFindFirstOrThrowSelectSchema.optional(), include: z.lazy(() => InquiryIncludeObjectSchema.optional()), orderBy: z.union([InquiryOrderByWithRelationInputObjectSchema, InquiryOrderByWithRelationInputObjectSchema.array()]).optional(), where: InquiryWhereInputObjectSchema.optional(), cursor: InquiryWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.union([InquiryScalarFieldEnumSchema, InquiryScalarFieldEnumSchema.array()]).optional() }).strict();