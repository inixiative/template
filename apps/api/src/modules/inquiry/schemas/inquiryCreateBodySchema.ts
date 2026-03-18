import { z } from '@hono/zod-openapi';
import { InquiryScalarInputSchema } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';

export const inquiryCreateBodySchema = InquiryScalarInputSchema.omit({ resolution: true }).extend({
  status: z.enum([InquiryStatus.draft, InquiryStatus.sent]).default(InquiryStatus.draft),
  targetUserId: z.string().optional(),
  targetOrganizationId: z.string().optional(),
  targetSpaceId: z.string().optional(),
  targetEmail: z.string().email().optional(),
  targetOrganizationSlug: z.string().optional(),
  targetSpaceSlug: z.string().optional(),
});

export const inquiryCreateSanitizeKeys = [
  'sentAt',
  'sourceModel',
  'sourceUserId',
  'sourceOrganizationId',
  'sourceSpaceId',
] as const;
