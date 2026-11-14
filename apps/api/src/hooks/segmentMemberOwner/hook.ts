import { DbAction, db, HookTiming, registerDbHook } from '@template/db';
import type { SegmentMember } from '@template/db/generated/client/client';
import { castArray } from 'lodash-es';
import { makeError } from '#/lib/errors';
import { providerWhere, segmentOwnerId } from '#/modules/segment/lib/segmentOwner';

type MemberRow = Partial<SegmentMember>;

const assertMemberBelongsToOwner = async (row: MemberRow): Promise<void> => {
  if (!row.segmentId || !row.customerRefId) return;
  const segment = await db.segment.findUnique({ where: { id: row.segmentId } });
  if (!segment) throw makeError({ status: 422, message: `Segment ${row.segmentId} not found` });
  const customerRef = await db.customerRef.findFirst({
    where: { id: row.customerRefId, ...providerWhere(segment.ownerModel, segmentOwnerId(segment)) },
  });
  if (!customerRef) {
    throw makeError({
      status: 422,
      message: `CustomerRef ${row.customerRefId} is not a customer of the segment's ${segment.ownerModel}`,
    });
  }
};

export const registerSegmentMemberOwnerHook = () => {
  registerDbHook(
    'segmentMemberOwner:create',
    'SegmentMember',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => {
      for (const row of castArray((args as { data: MemberRow | MemberRow[] }).data)) {
        await assertMemberBelongsToOwner(row);
      }
    },
  );

  registerDbHook(
    'segmentMemberOwner:upsert',
    'SegmentMember',
    HookTiming.before,
    [DbAction.upsert],
    async ({ args }) => {
      const a = args as { create?: MemberRow };
      if (a.create) await assertMemberBelongsToOwner(a.create);
    },
  );
};
