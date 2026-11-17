/**
 * @atlas
 * @kind hook
 * @partOf feature:inquiry
 * @uses infrastructure:prisma
 */
import {
  DbAction,
  db,
  type HookOptions,
  HookTiming,
  polymorphicKeyColumn,
  registerDbHook,
} from '@template/db';
import type { Entitlement, Prisma } from '@template/db/generated/client/client';
import { InquiryType } from '@template/db/generated/client/enums';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import { castArray, groupBy, keyBy } from 'lodash-es';
import { holderModels } from '#/modules/inquiry/handlers/changeEntitlements';
import type { ChangeEntitlementsContent } from '#/modules/inquiry/handlers/changeEntitlements/schema';
import { inquiryCancellation } from '#/modules/inquiry/services/inquiryCancellation';
import { inquiryTerminalStatuses } from '#/modules/inquiry/validations/validateInquiryStatus';

type Row = Pick<Entitlement, 'id' | 'targetModel' | 'targetId' | 'deletedAt'>;

const removedNow = ({ previous, result }: HookOptions): Row[] => {
  const before = keyBy(castArray((previous ?? []) as Row[]), 'id');
  return castArray((result ?? []) as Row[]).filter(
    (row) =>
      row.deletedAt != null && before[row.id] !== undefined && before[row.id]!.deletedAt == null,
  );
};

/**
 * A row that is gone leaves every open request to change its holder's entitlements: it drops out
 * of each request's `remove`, as its own audited update, and a request left asking for nothing is
 * canceled (Aron, 2026-11-16). The request being approved is not touched; it records what was asked.
 */
export const registerEntitlementChangeRequestsHook = () => {
  registerDbHook(
    'inquiry:dropRemovedEntitlements',
    ['Entitlement'],
    HookTiming.after,
    [DbAction.update, DbAction.updateManyAndReturn],
    async (options: HookOptions) => {
      const removed = removedNow(options);
      if (!removed.length) return;
      const resolving = auditActorContext.getScope()?.sourceInquiryId ?? null;
      for (const rows of Object.values(
        groupBy(removed, (row) => `${row.targetModel}:${row.targetId}`),
      )) {
        const [{ targetModel, targetId }] = rows as [Row];
        const model = holderModels.find((holderModel) => holderModel === targetModel);
        if (!model || !targetId) continue;
        const gone = new Set(rows.map(({ id }) => id));
        const requests = await db.inquiry.findMany({
          where: {
            type: InquiryType.changeEntitlements,
            status: { notIn: inquiryTerminalStatuses },
            targetModel: model,
            [polymorphicKeyColumn('Inquiry', 'targetModel', model) as string]: targetId,
            ...(resolving ? { id: { not: resolving } } : {}),
          },
        });
        for (const request of requests) {
          const content = request.content as ChangeEntitlementsContent;
          const remove = (content.remove ?? []).filter((id) => !gone.has(id));
          if (remove.length === (content.remove ?? []).length) continue;
          await db.inquiry.update({
            where: { id: request.id },
            data:
              remove.length || content.add?.length
                ? { content: { ...content, remove } as Prisma.InputJsonValue }
                : inquiryCancellation,
          });
        }
      }
    },
  );
};
