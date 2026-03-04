import { InquiryScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const inquiryUpdateRoute = updateRoute({
  model: Modules.inquiry,
  bodySchema: InquiryScalarSchema.partial(),
  responseSchema: InquiryScalarSchema,
  sanitizeKeys: ['status', 'type', 'sentAt', 'resolution', 'sourceModel', 'sourceUserId', 'sourceOrganizationId', 'sourceSpaceId', 'targetModel', 'targetOrganizationId', 'targetSpaceId'],
  tags: ['Inquiries'],
  middleware: [validatePermission('update')],
});
