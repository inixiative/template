import type { Prisma } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import type { Context } from 'hono';
import { emitAppEvent } from '#/appEvents/emit';
import { auditActorContext } from '#/lib/auditActorContext';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import type { Inquiry } from '#/modules/inquiry/handlers/types';
import { includeInquiryReceived } from '#/modules/inquiry/queries/inquiryIncludes';
import { computeExpiresAt } from '#/modules/inquiry/services/computeExpiresAt';
import { resolveContent } from '#/modules/inquiry/services/resolveContent';
import type { AppEnv } from '#/types/appEnv';

type ResolutionStatus = 'approved' | 'denied' | 'changesRequested';

export const resolveInquiry = async (
  c: Context<AppEnv>,
  inquiry: Inquiry,
  status: ResolutionStatus,
  resolutionData: Record<string, unknown>,
): Promise<Inquiry> => {
  const db = c.get('db');

  auditActorContext.extend({ sourceInquiryId: inquiry.id });

  try {
    return await db.txn(async () => {
      let approvalOutput: Record<string, unknown> = {};

      if (status === InquiryStatus.approved) {
        const handler = inquiryHandlers[inquiry.type];
        const content = handler.contentSchema.parse(inquiry.content);
        const merged = resolveContent(content, resolutionData, handler.resolutionInputSchema);
        approvalOutput = (await handler.handleApprove(db, inquiry, merged)) ?? {};
      }

      const expiresAt = status === InquiryStatus.changesRequested ? computeExpiresAt(inquiry.type) : null;

      const updated = await db.inquiry.update({
        where: { id: inquiry.id },
        data: {
          status,
          resolution: { ...resolutionData, ...approvalOutput } as Prisma.InputJsonValue,
          expiresAt,
        },
        include: includeInquiryReceived,
      });

      await emitAppEvent(
        'inquiry.resolved',
        { ...updated, _resolution: status },
        { resourceType: 'Inquiry', resourceId: inquiry.id },
      );

      return updated;
    });
  } finally {
    auditActorContext.extend({ sourceInquiryId: null });
  }
};
