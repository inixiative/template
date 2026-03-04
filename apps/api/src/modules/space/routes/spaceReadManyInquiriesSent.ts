import { InquiryScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { INQUIRY_SEARCHABLE_FIELDS } from '#/modules/inquiry/schemas/inquirySearchableFields';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const spaceReadManyInquiriesSentRoute = readRoute({
  model: Modules.space,
  submodel: Modules.inquiry,
  action: 'sent',
  many: true,
  paginate: true,
  searchableFields: INQUIRY_SEARCHABLE_FIELDS,
  responseSchema: InquiryScalarSchema,
  middleware: [validatePermission('own')],
  tags: [Tags.space, Tags.inquiry],
});
