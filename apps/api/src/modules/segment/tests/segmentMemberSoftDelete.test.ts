import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db, revive } from '@template/db';
import type { CustomerRelationship, Segment, Space } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createCustomerRelationship,
  createOrganizationUser,
  createRuleReference,
  createSegment,
  createSegmentMember,
  createSpace,
  createUser,
} from '@template/db/test';
import { applyMembershipDiff } from '#/modules/segment/services/applyMembershipDiff';
import { segmentMemberCustomerRelationshipIds } from '#/modules/segment/tests/fixtures';

const memberStamps = async (segmentId: string) =>
  (
    await db.withDeleted(() =>
      db.segmentMember.findMany({ where: { segmentId }, orderBy: { createdAt: 'asc' } }),
    )
  ).map((member) => member.deletedAt);

describe('segment members are soft-deleted (Aron, 2026-11-19)', () => {
  let space: Space;
  let segment: Segment;
  let relationship: CustomerRelationship;

  beforeEach(async () => {
    const { context } = await createOrganizationUser({ role: 'admin' });
    space = (await createSpace({}, { organization: context.organization })).entity;
    const { entity: customer } = await createUser();
    relationship = (
      await createCustomerRelationship({
        customerModel: 'User',
        providerModel: 'Space',
        customerUserId: customer.id,
        providerSpaceId: space.id,
      })
    ).entity;
    segment = (await createSegment({ ownerModel: 'Space' }, { space })).entity;
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('a removed member is tombstoned, and coming back writes a new live row', async () => {
    await applyMembershipDiff({ segmentId: segment.id, matching: [relationship.id] });
    const removed = await applyMembershipDiff({ segmentId: segment.id, matching: [] });
    expect(removed.removed).toEqual([relationship.id]);
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([]);

    const added = await applyMembershipDiff({ segmentId: segment.id, matching: [relationship.id] });

    expect(added.added).toEqual([relationship.id]);
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([relationship.id]);
    const [first, second] = await memberStamps(segment.id);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it('removing a member stamps the rule references naming it', async () => {
    const { entity: member } = await createSegmentMember(
      {},
      { segment, customerRelationship: relationship },
    );
    const { entity: naming } = await createSegment({ ownerModel: 'Space' }, { space });
    const { entity: edge } = await createRuleReference({
      sourceModel: 'Segment',
      sourceSegmentId: naming.id,
      targetModel: 'SegmentMember',
      targetSegmentMemberId: member.id,
    });

    await applyMembershipDiff({ segmentId: segment.id, matching: [] });

    expect(
      (await db.ruleReference.findUniqueOrThrow({ where: { id: edge.id } })).targetDeletedAt,
    ).not.toBeNull();
  });

  it('tombstoning a segment tombstones its members with its stamp and degrades rules naming them; reviving heals both', async () => {
    const { entity: member } = await createSegmentMember(
      {},
      { segment, customerRelationship: relationship },
    );
    const { entity: naming } = await createSegment({ ownerModel: 'Space' }, { space });
    const { entity: edge } = await createRuleReference({
      sourceModel: 'Segment',
      sourceSegmentId: naming.id,
      targetModel: 'SegmentMember',
      targetSegmentMemberId: member.id,
    });
    const edgeStamp = async () =>
      (await db.ruleReference.findUniqueOrThrow({ where: { id: edge.id } })).targetDeletedAt;

    const { deletedAt } = await db.segment.update({
      where: { id: segment.id },
      data: { deletedAt: new Date() },
    });
    expect(await memberStamps(segment.id)).toEqual([deletedAt]);
    expect(await edgeStamp()).toEqual(deletedAt);

    await revive(db.segment, { id: segment.id });
    expect(await memberStamps(segment.id)).toEqual([null]);
    expect(await edgeStamp()).toBeNull();
  });
});
