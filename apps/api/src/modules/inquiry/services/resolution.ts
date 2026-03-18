import type { Prisma } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import type { Context } from 'hono';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { computeExpiresAt } from '#/modules/inquiry/services/computeExpiresAt';
import { resolveContent } from '#/modules/inquiry/services/resolveContent';
import type { AppEnv } from '#/types/appEnv';

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

    const expiresAt = status === InquiryStatus.changesRequested ? computeExpiresAt(inquiry.type) : null;

    return db.inquiry.update({
      where: { id: inquiry.id },
      data: {
        status,
        resolution: { ...resolutionData, ...approvalOutput } as Prisma.InputJsonValue,
        expiresAt,
      },
    });
  });
};
