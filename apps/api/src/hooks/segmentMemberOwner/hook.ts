import { DbAction, db, HookTiming, registerDbHook } from '@template/db';
import type { SegmentMember } from '@template/db/generated/client/client';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { castArray, chunk } from 'lodash-es';
import { makeError } from '#/lib/errors';
import { customerRelationshipProviderFk, segmentOwnerId } from '#/modules/segment/lib/segmentOwner';

type MemberRow = Partial<SegmentMember>;

const VALIDATION_CHUNK_SIZE = 2_000;

const validateMembersBelongToOwners = async (rows: MemberRow[]): Promise<void> => {
  const pending = rows.filter((row): row is { segmentId: string; customerRelationshipId: string } =>
    Boolean(row.segmentId && row.customerRelationshipId),
  );
  if (!pending.length) return;

  const uniqueSegmentIds = [...new Set(pending.map((row) => row.segmentId))];
  const segments = await db.segment.findMany({
    where: { id: { in: uniqueSegmentIds } },
    select: {
      id: true,
      ownerModel: true,
      userId: true,
      organizationId: true,
      spaceId: true,
    },
  });
  const segmentsById = new Map(segments.map((segment) => [segment.id, segment]));

  const groups = new Map<
    string,
    {
      ownerModel: ProviderModel;
      ownerId: string;
      rows: { segmentId: string; customerRelationshipId: string }[];
    }
  >();

  for (const row of pending) {
    const segment = segmentsById.get(row.segmentId);
    if (!segment) throw makeError({ status: 422, message: `Segment ${row.segmentId} not found` });
    const ownerId = segmentOwnerId(segment);
    const key = `${segment.ownerModel}:${ownerId}`;
    let group = groups.get(key);
    if (!group) {
      group = { ownerModel: segment.ownerModel, ownerId, rows: [] };
      groups.set(key, group);
    }
    group.rows.push(row);
  }

  for (const group of groups.values()) {
    const uniqueCustomerRelationshipIds = [
      ...new Set(group.rows.map((row) => row.customerRelationshipId)),
    ];
    const matchedIds = new Set<string>();
    const fk = customerRelationshipProviderFk(group.ownerModel);

    for (const batch of chunk(uniqueCustomerRelationshipIds, VALIDATION_CHUNK_SIZE)) {
      const matched = await db.customerRelationship.findMany({
        where: {
          id: { in: batch },
          providerModel: group.ownerModel,
          [fk]: group.ownerId,
        },
        select: { id: true },
      });
      for (const relationship of matched) matchedIds.add(relationship.id);
    }

    for (const row of group.rows) {
      if (!matchedIds.has(row.customerRelationshipId)) {
        throw makeError({
          status: 422,
          message: `CustomerRelationship ${row.customerRelationshipId} is not a customer of the segment's ${group.ownerModel}`,
        });
      }
    }
  }
};

export const registerValidateSegmentMemberIsCustomerOfSegmentOwnerHook = () => {
  registerDbHook(
    'segmentMemberOwner:create',
    'SegmentMember',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => {
      await validateMembersBelongToOwners(
        castArray((args as { data: MemberRow | MemberRow[] }).data),
      );
    },
  );

  registerDbHook(
    'segmentMemberOwner:upsert',
    'SegmentMember',
    HookTiming.before,
    [DbAction.upsert],
    async ({ args }) => {
      const a = args as { create?: MemberRow };
      if (a.create) await validateMembersBelongToOwners([a.create]);
    },
  );
};
