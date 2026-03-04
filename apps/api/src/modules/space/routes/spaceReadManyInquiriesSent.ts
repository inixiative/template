import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquirySentResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { INQUIRY_SEARCHABLE_FIELDS } from '#/modules/inquiry/schemas/inquirySearchableFields';
import { Modules } from '#/modules/modules';

export const spaceReadManyInquiriesSentRoute = readRoute({
  model: Modules.space,
  submodel: Modules.inquiry,
  action: 'sent',
  many: true,
  paginate: true,
  searchableFields: INQUIRY_SEARCHABLE_FIELDS,
  responseSchema: inquirySentResponseSchema,
  middleware: [validatePermission('manage')],
});
