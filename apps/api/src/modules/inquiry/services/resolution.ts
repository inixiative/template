import type { Db, Prisma, UserId } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { resolveContent } from '#/modules/inquiry/services/utils/resolveContent';

type Inquiry = Prisma.InquiryGetPayload<{}>;
type ResolutionOutcome = 'approved' | 'denied';

export const resolveInquiry = async (
  db: Db,
  inquiry: Inquiry,
  outcome: ResolutionOutcome,
  resolutionData: Record<string, unknown>,
  resolverId: UserId,
): Promise<Inquiry> => {
  return db.txn(async () => {
    let approvalOutput: Record<string, unknown> = {};

    if (outcome === InquiryStatus.approved) {
      const handler = inquiryHandlers[inquiry.type];
      const content = inquiry.content as Record<string, unknown>;
      const merged = resolveContent(content, resolutionData, handler.resolutionSchema);
      approvalOutput = (await handler.handleApprove(db, inquiry, merged)) ?? {};
    }

    return db.inquiry.update({
      where: { id: inquiry.id },
      data: {
        status: outcome,
        resolution: {
          ...resolutionData,
          ...approvalOutput,
          resolvedBy: resolverId,
          resolvedAt: new Date().toISOString(),
        },
      },
    });
  });
};
