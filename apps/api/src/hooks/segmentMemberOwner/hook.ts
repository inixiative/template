import { DbAction, db, HookTiming, registerDbHook } from '@template/db';
import type { SegmentMember } from '@template/db/generated/client/client';
import { castArray } from 'lodash-es';
import { makeError } from '#/lib/errors';
import { customerRefProviderFk, segmentOwnerId } from '#/modules/segment/lib/segmentOwner';

type MemberRow = Partial<SegmentMember> & Record<string, unknown>;

const assertMemberBelongsToOwner = async (row: MemberRow): Promise<void> => {
  if (!row.segmentId || !row.customerRefId) return;
  const [segment, customerRef] = await Promise.all([
    db.segment.findUnique({ where: { id: row.segmentId } }),
    db.customerRef.findUnique({ where: { id: row.customerRefId } }),
  ]);
  if (!segment) throw makeError({ status: 422, message: `Segment ${row.segmentId} not found` });
  if (!customerRef) throw makeError({ status: 422, message: `CustomerRef ${row.customerRefId} not found` });

  const providerFk = customerRefProviderFk(segment.ownerModel);
  const providerId = providerFk ? (customerRef as unknown as Record<string, unknown>)[providerFk] : null;
  if (!providerFk || providerId !== segmentOwnerId(segment)) {
    throw makeError({
      status: 422,
      message: `CustomerRef ${customerRef.id} is not a customer of the segment's ${segment.ownerModel}`,
    });
  }
};

const rowsOf = (data: unknown): MemberRow[] => (data === undefined ? [] : (castArray(data) as MemberRow[]));

export const registerSegmentMemberOwnerHook = () => {
  registerDbHook(
    'segmentMemberOwner:create',
    'SegmentMember',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => {
      for (const row of rowsOf((args as { data?: unknown }).data)) await assertMemberBelongsToOwner(row);
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
