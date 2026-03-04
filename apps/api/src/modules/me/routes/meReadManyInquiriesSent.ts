import { InquiryScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { INQUIRY_SEARCHABLE_FIELDS } from '#/modules/inquiry/schemas/inquirySearchableFields';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meReadManyInquiriesSentRoute = readRoute({
  model: Modules.me,
  submodel: Modules.inquiry,
  action: 'sent',
  many: true,
  skipId: true,
  paginate: true,
  searchableFields: INQUIRY_SEARCHABLE_FIELDS,
  responseSchema: InquiryScalarSchema,
  tags: [Tags.me, Tags.inquiry],
});
