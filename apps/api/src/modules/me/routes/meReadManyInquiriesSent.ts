import { readRoute } from '#/lib/routeTemplates';
import { inquirySentResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { inquirySearchableFields } from '#/modules/inquiry/schemas/inquirySearchableFields';
import { Modules } from '#/modules/modules';

export const meReadManyInquiriesSentRoute = readRoute({
  model: Modules.me,
  submodel: Modules.inquiry,
  action: 'sent',
  many: true,
  skipId: true,
  paginate: true,
  searchableFields: inquirySearchableFields,
  responseSchema: inquirySentResponseSchema,
});
