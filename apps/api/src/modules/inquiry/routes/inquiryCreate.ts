import { z } from '@hono/zod-openapi';
import { InquiryScalarSchema } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { createRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

const bodySchema = InquiryScalarSchema.extend({
  status: z.enum([InquiryStatus.draft, InquiryStatus.sent]).default(InquiryStatus.draft),
  targetUserId: z.string().uuid().optional(),
  targetEmail: z.string().email().optional(),
});

export const inquiryCreateRoute = createRoute({
  model: Modules.inquiry,
  bodySchema,
  responseSchema: InquiryScalarSchema,
  sanitizeKeys: ['sentAt', 'resolution', 'sourceModel', 'sourceUserId', 'sourceOrganizationId', 'sourceSpaceId', 'targetModel', 'targetOrganizationId', 'targetSpaceId'],
});
