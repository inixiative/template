import { InquiryResourceModel } from '@template/db/generated/client/enums';
import { readRoute } from '#/lib/routeTemplates';
import { scopeNarrowing } from '#/middleware/resources/scopeNarrowing';
import { inquiryNarrowing } from '#/modules/inquiry/schemas/inquiryNarrowing';
import { inquirySentResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

export const meReadManyInquiriesSentRoute = readRoute({
  model: Modules.me,
  submodel: Modules.inquiry,
  action: 'sent',
  many: true,
  skipId: true,
  paginate: true,
  narrowing: inquiryNarrowing,
  responseSchema: inquirySentResponseSchema,
  middleware: [
    scopeNarrowing((c) => ({
      where: {
        all: [
          { field: 'sourceModel', operator: 'equals', value: InquiryResourceModel.User },
          { field: 'sourceUserId', operator: 'equals', value: c.get('user')!.id },
        ],
      },
    })),
  ],
});
