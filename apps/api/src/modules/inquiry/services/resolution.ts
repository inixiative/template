/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses infrastructure:prisma, primitive:appEvents
 */
import type { Prisma } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import type { Context } from 'hono';
import { emitAppEvent } from '#/appEvents/emit';
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
      // Row-lock first: serializes concurrent resolves so the second re-reads the committed status and the validator rejects.
      const [fresh] = await db.findForUpdate<Inquiry>('Inquiry', { id: inquiry.id });
      validateInquiryIsResolvable(fresh!);

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

      await emitAppEvent('inquiry.resolved', { ...updated, _resolution: status });

      return updated;
    });
  } finally {
    auditActorContext.extend({ sourceInquiryId: null });
  }
};
