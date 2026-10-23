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
import { makeError } from '#/lib/errors';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import type { Inquiry } from '#/modules/inquiry/handlers/types';
import { includeInquiryReceived } from '#/modules/inquiry/queries/inquiryIncludes';
import type { InquiryResolutionStatus } from '#/modules/inquiry/schemas/inquiryResolutionStatusSchema';
import { computeExpiresAt } from '#/modules/inquiry/services/computeExpiresAt';
import { lockInquiryAtVersion } from '#/modules/inquiry/services/lockInquiryAtVersion';
import { resolveContent } from '#/modules/inquiry/services/resolveContent';
import { validateInquiryIsResolvable } from '#/modules/inquiry/validations/validateInquiryStatus';
import type { AppEnv } from '#/types/appEnv';

export const resolveInquiry = async (
  c: Context<AppEnv>,
  inquiry: Inquiry,
  status: InquiryResolutionStatus,
  resolutionData: Record<string, unknown>,
  expectedUpdatedAt?: Date,
): Promise<Inquiry> => {
  const db = c.get('db');

  auditActorContext.extend({ sourceInquiryId: inquiry.id });

  try {
    return await db.txn(async () => {
      const fresh = await lockInquiryAtVersion(inquiry.id, expectedUpdatedAt);
      validateInquiryIsResolvable(fresh);

      let approvalOutput: Record<string, unknown> = {};

      if (status === InquiryStatus.approved) {
        const handler = inquiryHandlers[fresh.type];
        const content = handler.contentSchema.parse(fresh.content);
        const merged = resolveContent(content, resolutionData, handler.resolutionInputSchema);
        if (handler.canApprove && !(await handler.canApprove(c, fresh, merged)))
          throw makeError({ status: 403, message: 'You cannot grant what this inquiry asks for' });
        approvalOutput = (await handler.handleApprove(fresh, merged)) ?? {};
      }

      const expiresAt =
        status === InquiryStatus.changesRequested ? computeExpiresAt(fresh.type) : null;

      const updated = await db.inquiry.update({
        where: { id: fresh.id },
        data: {
          status,
          resolution: { ...resolutionData, ...approvalOutput } as Prisma.InputJsonValue,
          expiresAt,
        },
        include: includeInquiryReceived,
      });

      await emitAppEvent('inquiry.resolved', updated);

      return updated;
    });
  } finally {
    auditActorContext.extend({ sourceInquiryId: null });
  }
};
