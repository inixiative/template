import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquiryReceivedResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { inquirySearchableFields } from '#/modules/inquiry/schemas/inquirySearchableFields';
import { Modules } from '#/modules/modules';

export const spaceReadManyInquiriesReceivedRoute = readRoute({
  model: Modules.space,
  submodel: Modules.inquiry,
  action: 'received',
  many: true,
  paginate: true,
  searchableFields: inquirySearchableFields,
  responseSchema: inquiryReceivedResponseSchema,
  middleware: [validatePermission('manage')],
});
