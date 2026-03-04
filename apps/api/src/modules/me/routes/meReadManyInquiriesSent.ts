import { readRoute } from '#/lib/routeTemplates';
import { inquirySentResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { INQUIRY_SEARCHABLE_FIELDS } from '#/modules/inquiry/schemas/inquirySearchableFields';
import { Modules } from '#/modules/modules';

export const meReadManyInquiriesSentRoute = readRoute({
  model: Modules.me,
  submodel: Modules.inquiry,
  action: 'sent',
  many: true,
  skipId: true,
  paginate: true,
  searchableFields: INQUIRY_SEARCHABLE_FIELDS,
  responseSchema: inquirySentResponseSchema,
});
