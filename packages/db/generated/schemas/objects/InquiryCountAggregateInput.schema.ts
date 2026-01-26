import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';


const makeSchema = () => z.object({
  id: z.literal(true).optional(),
  createdAt: z.literal(true).optional(),
  updatedAt: z.literal(true).optional(),
  sentAt: z.literal(true).optional(),
  type: z.literal(true).optional(),
  status: z.literal(true).optional(),
  content: z.literal(true).optional(),
  resolution: z.literal(true).optional(),
  sourceModel: z.literal(true).optional(),
  sourceUserId: z.literal(true).optional(),
  sourceOrganizationId: z.literal(true).optional(),
  targetModel: z.literal(true).optional(),
  targetUserId: z.literal(true).optional(),
  targetOrganizationId: z.literal(true).optional(),
  _all: z.literal(true).optional()
}).strict();
export const InquiryCountAggregateInputObjectSchema: z.ZodType<Prisma.InquiryCountAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.InquiryCountAggregateInputType>;
export const InquiryCountAggregateInputObjectZodSchema = makeSchema();
