import { InquiryResourceModel, InquiryStatus } from '@template/db/generated/client/enums';
import { readRoute } from '#/lib/routeTemplates';
import { scopeNarrowing } from '#/middleware/resources/scopeNarrowing';
import { inquiryNarrowing } from '#/modules/inquiry/schemas/inquiryNarrowing';
import { inquiryReceivedResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

export const meReadManyInquiriesReceivedRoute = readRoute({
  model: Modules.me,
  submodel: Modules.inquiry,
  action: 'received',
  many: true,
  skipId: true,
  paginate: true,
  narrowing: inquiryNarrowing,
  responseSchema: inquiryReceivedResponseSchema,
  middleware: [
    scopeNarrowing((c) => ({
      where: {
        all: [
          { field: 'targetModel', operator: 'equals', value: InquiryResourceModel.User },
          { field: 'targetUserId', operator: 'equals', value: c.get('user')!.id },
          { field: 'status', operator: 'notEquals', value: InquiryStatus.draft },
        ],
      },
    })),
  ],
});
