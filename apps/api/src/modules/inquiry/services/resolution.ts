import type { Db, Prisma } from '@template/db';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { resolveContent } from '#/modules/inquiry/services/utils/resolveContent';

type Inquiry = Prisma.InquiryGetPayload<{}>;
type ResolutionOutcome = 'approved' | 'denied';

export const resolveInquiry = async (
  db: Db,
  inquiry: Inquiry,
  outcome: ResolutionOutcome,
  resolutionData: Record<string, unknown>,
  resolverId: string,
): Promise<Inquiry> => {
  return db.txn(async () => {
    if (outcome === 'approved') {
      const handler = inquiryHandlers[inquiry.type];
      const content = inquiry.content as Record<string, unknown>;
      const merged = resolveContent(content, resolutionData);
      await handler.handleApprove(db, inquiry, merged);
    }

    return db.inquiry.update({
      where: { id: inquiry.id },
      data: {
        status: outcome,
        resolution: {
          ...resolutionData,
          resolvedBy: resolverId,
          resolvedAt: new Date().toISOString(),
        },
      },
    });
  });
};
