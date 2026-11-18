/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses infrastructure:prisma, primitive:appEvents
 */
import type { Prisma } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { auditActorContext, nullAuditActor } from '@template/db/lib/auditActorContext';
import type { Context } from 'hono';
import { emitAppEvent } from '#/appEvents/emit';
import { includeInquiryResponse } from '#/modules/inquiry/queries/inquiryIncludes';
import type { InquiryResolutionStatus } from '#/modules/inquiry/schemas/inquiryResolutionStatusSchema';
import { inquiryServices } from '#/modules/inquiry/services';
import { computeExpiresAt } from '#/modules/inquiry/services/computeExpiresAt';
import { lockInquiryAtVersion } from '#/modules/inquiry/services/lockInquiryAtVersion';
import type { Inquiry } from '#/modules/inquiry/services/types';
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

  // why: the resolving inquiry is known to every write below (audit attribution, the request hooks), with or without a request scope
  return auditActorContext.scope(
    { ...(auditActorContext.currentActor() ?? nullAuditActor), sourceInquiryId: inquiry.id },
    () =>
      db.txn(async () => {
        const fresh = await lockInquiryAtVersion(inquiry.id, expectedUpdatedAt);
        validateInquiryIsResolvable(fresh);

        const service = inquiryServices[fresh.type];
        const response = service.resolutionInputSchema.parse(resolutionData);
        let approvalOutput: Record<string, unknown> = {};

        if (status === InquiryStatus.approved) {
          approvalOutput =
            (await service.handleApprove(
              c,
              fresh,
              service.contentSchema.parse(fresh.content),
              response,
            )) ?? {};
        }

        const expiresAt =
          status === InquiryStatus.changesRequested ? computeExpiresAt(fresh.type) : null;

        const updated = await db.inquiry.update({
          where: { id: fresh.id },
          data: {
            status,
            resolution: service.resolutionSchema.parse({
              ...response,
              ...approvalOutput,
            }) as Prisma.InputJsonValue,
            expiresAt,
          },
          include: includeInquiryResponse,
        });

        await emitAppEvent('inquiry.resolved', updated);

        return updated;
      }),
  );
};
