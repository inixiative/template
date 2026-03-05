import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquirySentResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { inquirySearchableFields } from '#/modules/inquiry/schemas/inquirySearchableFields';
import { Modules } from '#/modules/modules';

export const organizationReadManyInquiriesSentRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.inquiry,
  action: 'sent',
  many: true,
  paginate: true,
  searchableFields: inquirySearchableFields,
  responseSchema: inquirySentResponseSchema,
  middleware: [validatePermission('manage')],
});
