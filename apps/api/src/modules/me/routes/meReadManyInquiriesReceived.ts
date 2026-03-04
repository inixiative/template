import { readRoute } from '#/lib/routeTemplates';
import { inquiryReceivedResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { INQUIRY_SEARCHABLE_FIELDS } from '#/modules/inquiry/schemas/inquirySearchableFields';
import { Modules } from '#/modules/modules';

export const meReadManyInquiriesReceivedRoute = readRoute({
  model: Modules.me,
  submodel: Modules.inquiry,
  action: 'received',
  many: true,
  skipId: true,
  paginate: true,
  searchableFields: INQUIRY_SEARCHABLE_FIELDS,
  responseSchema: inquiryReceivedResponseSchema,
});
