import type { Prisma } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import type { Context } from 'hono';
import { inquiryResolvedEvent } from '#/events/definitions';
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
  const user = c.get('user');

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

      await inquiryResolvedEvent.emit(
        {
          inquiryId: inquiry.id,
          inquiryType: inquiry.type,
          resolution: status,
          sourceOrganizationId: inquiry.sourceOrganizationId ?? undefined,
          sourceUserId: inquiry.sourceUserId ?? undefined,
          targetUserId: inquiry.targetUserId ?? undefined,
          inquiry: updated as unknown as Record<string, unknown>,
        },
        {
          actorId: user?.id,
          resourceType: 'Inquiry',
          resourceId: inquiry.id,
        },
      );

      return updated;
    });
  } finally {
    auditActorContext.extend({ sourceInquiryId: null });
  }
};
