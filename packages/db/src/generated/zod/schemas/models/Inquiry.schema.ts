import * as z from 'zod';
import { InquiryResourceModelSchema } from '../enums/InquiryResourceModel.schema';
import { InquiryStatusSchema } from '../enums/InquiryStatus.schema';
import { InquiryTypeSchema } from '../enums/InquiryType.schema';

export const InquirySchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  sentAt: z.date().nullish(),
  type: InquiryTypeSchema,
  status: InquiryStatusSchema.default("draft"),
  content: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").default("{}"),
  resolution: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").default("{}"),
  sourceModel: InquiryResourceModelSchema,
  sourceUserId: z.string().nullish(),
  sourceOrganizationId: z.string().nullish(),
  targetModel: InquiryResourceModelSchema.nullish(),
  targetUserId: z.string().nullish(),
  targetOrganizationId: z.string().nullish(),
});

export type InquiryType = z.infer<typeof InquirySchema>;
