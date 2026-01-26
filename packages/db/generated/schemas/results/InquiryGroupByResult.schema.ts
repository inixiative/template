import * as z from 'zod';
export const InquiryGroupByResultSchema = z.array(z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  sentAt: z.date(),
  content: z.unknown(),
  resolution: z.unknown(),
  sourceUserId: z.string(),
  sourceOrganizationId: z.string(),
  targetUserId: z.string(),
  targetOrganizationId: z.string(),
  _count: z.object({
    id: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    sentAt: z.number(),
    type: z.number(),
    status: z.number(),
    content: z.number(),
    resolution: z.number(),
    sourceModel: z.number(),
    sourceUserId: z.number(),
    sourceOrganizationId: z.number(),
    sourceUser: z.number(),
    sourceOrganization: z.number(),
    targetModel: z.number(),
    targetUserId: z.number(),
    targetOrganizationId: z.number(),
    targetUser: z.number(),
    targetOrganization: z.number()
  }).optional(),
  _min: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
    sentAt: z.date().nullable(),
    sourceUserId: z.string().nullable(),
    sourceOrganizationId: z.string().nullable(),
    targetUserId: z.string().nullable(),
    targetOrganizationId: z.string().nullable()
  }).nullable().optional(),
  _max: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
    sentAt: z.date().nullable(),
    sourceUserId: z.string().nullable(),
    sourceOrganizationId: z.string().nullable(),
    targetUserId: z.string().nullable(),
    targetOrganizationId: z.string().nullable()
  }).nullable().optional()
}));