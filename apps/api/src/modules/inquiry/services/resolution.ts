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
import { validateInquiryIsResolvable } from '#/modules/inquiry/validations/validateInquiryStatus';
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
      // Re-read fresh inside the txn so two concurrent resolves can't both pass
      // a stale-status check. NOTE: Postgres default isolation is READ COMMITTED,
      // so this still leaves a narrow window for two writers; full coverage
      // requires a conditional update with a rowcount check or SERIALIZABLE.
      const fresh = await db.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } });
      validateInquiryIsResolvable(fresh);

      let approvalOutput: Record<string, unknown> = {};

      if (status === InquiryStatus.approved) {
        const handler = inquiryHandlers[fresh.type];
        const content = handler.contentSchema.parse(fresh.content);
        const merged = resolveContent(content, resolutionData, handler.resolutionInputSchema);
        approvalOutput = (await handler.handleApprove(db, fresh, merged)) ?? {};
      }

      const expiresAt = status === InquiryStatus.changesRequested ? computeExpiresAt(fresh.type) : null;

      const updated = await db.inquiry.update({
        where: { id: fresh.id },
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
        { resourceType: 'Inquiry', resourceId: fresh.id },
      );

      return updated;
    });
  } finally {
    auditActorContext.extend({ sourceInquiryId: null });
  }
};
