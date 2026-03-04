import { InquiryScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const organizationReadManyInquiriesReceivedRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.inquiry,
  action: 'received',
  many: true,
  paginate: true,
  responseSchema: InquiryScalarSchema,
  middleware: [validatePermission('read')],
  tags: [Tags.organization, Tags.inquiry],
});
