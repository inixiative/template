import type { Prisma } from '@template/db';
import type { Context } from 'hono';
import { InquiryStatus } from '@template/db/generated/client/enums';
import type { AppEnv } from '#/types/appEnv';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { resolveContent } from '#/modules/inquiry/services/resolveContent';

type Inquiry = Prisma.InquiryGetPayload<{}>;
type ResolutionStatus = 'approved' | 'denied' | 'changesRequested';

export const resolveInquiry = async (
  c: Context<AppEnv>,
  inquiry: Inquiry,
  status: ResolutionStatus,
  resolutionData: Record<string, unknown>,
): Promise<Inquiry> => {
  const db = c.get('db');

  return db.txn(async () => {
    let approvalOutput: Record<string, unknown> = {};

    if (status === InquiryStatus.approved) {
      const handler = inquiryHandlers[inquiry.type];
      const content = handler.contentSchema.parse(inquiry.content);
      const merged = resolveContent(content, resolutionData, handler.resolutionInputSchema);
      approvalOutput = (await handler.handleApprove(db, inquiry, merged)) ?? {};
    }

    return db.inquiry.update({
      where: { id: inquiry.id },
      data: {
        status,
        resolution: { ...resolutionData, ...approvalOutput } as Prisma.InputJsonValue,
      },
    });
  });
};
