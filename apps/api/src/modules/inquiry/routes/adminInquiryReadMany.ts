import { readRoute } from '#/lib/routeTemplates';
import { inquiryResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { INQUIRY_SEARCHABLE_FIELDS } from '#/modules/inquiry/schemas/inquirySearchableFields';
import { Modules } from '#/modules/modules';

export const adminInquiryReadManyRoute = readRoute({
  model: Modules.inquiry,
  many: true,
  paginate: true,
  admin: true,
  searchableFields: INQUIRY_SEARCHABLE_FIELDS,
  responseSchema: inquiryResponseSchema,
});
