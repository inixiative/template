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
      // Fetch + row-lock in one query. Under READ COMMITTED, two concurrent
      // resolves could both pass `validateInquiryIsResolvable` on the same
      // stale row and both run `handleApprove` (double-effect side effects).
      // `SELECT … FOR UPDATE` makes the second caller wait here until the
      // first commits; the second then re-reads the new status and the
      // validator rejects. Single RTT vs SELECT-then-findUnique.
      const [fresh] = await db.$queryRaw<Inquiry[]>`SELECT * FROM "Inquiry" WHERE id = ${inquiry.id} FOR UPDATE`;
      validateInquiryIsResolvable(fresh!);

      let approvalOutput: Record<string, unknown> = {};

      if (status === InquiryStatus.approved) {
        const handler = inquiryHandlers[fresh.type];
        const content = handler.contentSchema.parse(fresh.content);
        const merged = resolveContent(content, resolutionData, handler.resolutionInputSchema);
        const freshWithRelations = { ...inquiry, ...fresh };
        if (handler.validate) await handler.validate(db, freshWithRelations, content);
        approvalOutput = (await handler.handleApprove(db, freshWithRelations, merged)) ?? {};
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
