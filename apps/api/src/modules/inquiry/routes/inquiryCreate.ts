import { z } from '@hono/zod-openapi';
import { InquiryScalarSchema } from '@template/db';
import { createRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

const bodySchema = InquiryScalarSchema.omit({
  sentAt: true,
  sourceModel: true,
  sourceUserId: true,
  sourceOrganizationId: true,
}).extend({
  targetUserId: z.string().uuid().optional(),
  targetEmail: z.string().email().optional(),
});

export const inquiryCreateRoute = createRoute({
  model: Modules.inquiry,
  bodySchema,
  responseSchema: InquiryScalarSchema,
  tags: ['Inquiries'],
});
