/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry, feature:users
 * @uses infrastructure:prisma, primitive:appEvents
 */
import { db, userKeyColumns } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import {
  type MergeUserContent,
  type MergeUserResolutionInput,
  mergeUserContentSchema,
  mergeUserResolutionInputSchema,
} from '@template/shared/inquiry';
import { isEqual } from 'lodash-es';
import { emitAppEvent } from '#/appEvents/emit';
import { queueCacheClearForMovedRows } from '#/hooks/cache/queueCacheClearForMovedRows';
import { makeError } from '#/lib/errors';
import { closeRowsWhoseEndsBecameOneRecord } from '#/modules/inquiry/services/mergeUser/closeRowsWhoseEndsBecameOneRecord';
import { fetchEdgeRowsPointingAtThemselves } from '#/modules/inquiry/services/mergeUser/fetchEdgeRowsPointingAtThemselves';
import { mergeUserRows } from '#/modules/inquiry/services/mergeUser/mergeUserRows';
import { orphanAuditColumnsOfSourceUser } from '#/modules/inquiry/services/mergeUser/orphanAuditColumnsOfSourceUser';
import type { InquiryService } from '#/modules/inquiry/services/types';

export const mergeUserService: InquiryService<
  MergeUserContent,
  MergeUserResolutionInput,
  MergeUserResolutionInput
> = {
  contentSchema: mergeUserContentSchema,
  resolutionInputSchema: mergeUserResolutionInputSchema,
  resolutionSchema: mergeUserResolutionInputSchema,
  unique: 'untargeted',
  defaultExpirationDays: 30,
  autoApprove: async () => false,

  validate: async (inquiry, content) => {
    if (content.sourceUser.id !== inquiry.sourceUserId)
      throw makeError({ status: 422, message: 'The source user must be the sender' });
    if (inquiry.sourceUserId === inquiry.targetUserId)
      throw makeError({ status: 422, message: 'A user cannot be merged into themselves' });
  },

  handleApprove: async (_c, inquiry, content, response) => {
    if (!isEqual(response.sourceUser, content.sourceUser))
      throw makeError({
        status: 422,
        message: 'The approval must name the same user the request merges',
      });
    const merge = {
      sourceUserId: inquiry.sourceUserId!,
      targetUserId: inquiry.targetUserId!,
      plannedWrites: new Map<string, Set<string | null>>(),
      plannedDeletes: new Set([`User.${inquiry.sourceUserId}`]),
    };

    const users = await db.findForUpdate<User>(
      'User',
      { id: { in: [merge.sourceUserId, merge.targetUserId] } },
      { changesKey: true },
    );
    const source = users.find(({ id }) => id === merge.sourceUserId);
    if (!source || !users.some(({ id }) => id === merge.targetUserId))
      throw makeError({ status: 404, message: 'A user in this merge is gone' });
    if (source.email !== content.sourceUser.email)
      throw makeError({ status: 409, message: 'The source user changed email since the request' });

    const alreadyOneRecord = new Set([
      `Inquiry.${inquiry.id}`,
      ...(
        await fetchEdgeRowsPointingAtThemselves([merge.sourceUserId, merge.targetUserId])
      ).flatMap(({ model, ids }) => ids.map((id) => `${model}.${id}`)),
    ]);
    await db.withUserMerge(merge, async () => {
      await mergeUserRows(merge);
      // why: Postgres rechecks every key of an audit row a SetNull touches, so a row naming the user and a cascaded subject fails unless the user columns clear first.
      await orphanAuditColumnsOfSourceUser(merge);
      await db.user.delete({ where: { id: merge.sourceUserId } });
    });
    await closeRowsWhoseEndsBecameOneRecord(merge.targetUserId, alreadyOneRecord);
    // why: a moved membership re-keys its children by ON UPDATE CASCADE, which the cache hook never sees.
    await queueCacheClearForMovedRows((model) =>
      userKeyColumns(model).map((column) => ({
        where: { [column]: merge.targetUserId },
        priorValues: { [column]: merge.sourceUserId },
      })),
    );
    const target = await db.user.findUniqueOrThrow({ where: { id: merge.targetUserId } });
    await emitAppEvent('user.updated', { user: target });
    return content;
  },
};
