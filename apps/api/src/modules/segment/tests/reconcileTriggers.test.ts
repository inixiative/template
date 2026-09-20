import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { clearHookRegistry, db, type ModelName } from '@template/db';
import type { CustomerRef, Segment, Space, Tag, User } from '@template/db/generated/client/client';
import { SegmentType } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createCustomerRef,
  createOrganizationUser,
  createSegment,
  createSpace,
  createTag,
  createTagAttachment,
  createUser,
  getNextSeq,
} from '@template/db/test';
import { emitAppEvent } from '#/appEvents/emit';
import { AppEventName } from '#/appEvents/handlers';
import { registerSegmentConditionsHook } from '#/hooks/segmentConditions/hook';
import { registerSegmentMemberOwnerHook } from '#/hooks/segmentMemberOwner/hook';
import { registerSegmentRuleReferencesHook } from '#/hooks/segmentRuleReferences/hook';
import { registerSoftDeleteCascadeHook } from '#/hooks/softDeleteCascade/hook';
import { RECONCILE_TRIGGERS } from '#/modules/segment/lib/reconcileTriggers';
import { segmentReachedModels } from '#/modules/segment/lib/segmentLens';

const taggedRule = (tagId: string) => ({
  field: 'customerUser.tagAttachments',
  arrayOperator: 'any',
  condition: { field: 'tag.id', operator: Operator.equals, value: tagId },
});

const acmeRule = { field: 'customerUser.email', operator: Operator.endsWith, value: '@acme.test' };

const memberIds = async (segmentId: string): Promise<string[]> =>
  (await db.segmentMember.findMany({ where: { segmentId } })).map((member) => member.customerRefId).sort();

describe('reconcile triggers — the lens defines the propagation graph', () => {
  it('every model the segment lens reads has an event that reconciles it, and every event exists', () => {
    const names = new Set<string>(Object.values(AppEventName));
    for (const model of segmentReachedModels()) {
      const events = RECONCILE_TRIGGERS[model as ModelName] ?? [];
      expect(events.length, `${model} has no reconcile trigger`).toBeGreaterThan(0);
      for (const event of events) expect(names.has(event), `${event} is not an app event`).toBe(true);
    }
  });
});

describe('reconcile triggers — membership follows the events', () => {
  let space: Space;
  let tag: Tag;
  let member: User;
  let memberRef: CustomerRef;

  const customerOf = async (user: User): Promise<CustomerRef> =>
    (
      await createCustomerRef({
        customerModel: 'User',
        providerModel: 'Space',
        customerUser: user,
        providerSpace: space,
      })
    ).entity;

  const liveSegment = async (conditions: object): Promise<Segment> => {
    const { entity } = await createSegment({ type: SegmentType.dynamic, conditions }, { space });
    await emitAppEvent('segment.created', { segment: entity });
    return entity;
  };

  beforeAll(async () => {
    registerSegmentConditionsHook();
    registerSegmentMemberOwnerHook();
    registerSegmentRuleReferencesHook();
    registerSoftDeleteCascadeHook();
    const { context } = await createOrganizationUser({ role: 'admin' });
    space = (await createSpace({}, { organization: context.organization })).entity;
    tag = (await createTag()).entity;
    member = (await createUser({ email: `member-${getNextSeq()}@example.test` })).entity;
    memberRef = await customerOf(member);
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('a tag attachment created or deleted moves the customer in and out of a tag segment', async () => {
    const segment = await liveSegment(taggedRule(tag.id));
    expect(await memberIds(segment.id)).toEqual([]);

    const { entity: attachment } = await createTagAttachment({ resourceModel: 'User' }, { user: member, tag });
    await emitAppEvent('tagAttachment.created', { tagAttachment: attachment });
    expect(await memberIds(segment.id)).toEqual([memberRef.id]);

    const detached = await db.tagAttachment.update({ where: { id: attachment.id }, data: { deletedAt: new Date() } });
    await emitAppEvent('tagAttachment.deleted', { tagAttachment: detached });
    expect(await memberIds(segment.id)).toEqual([]);
  });

  it('deleting a tag reconciles every resource it was attached to', async () => {
    const doomed = (await createTag()).entity;
    const segment = await liveSegment(taggedRule(doomed.id));
    const { entity: attachment } = await createTagAttachment({ resourceModel: 'User' }, { user: member, tag: doomed });
    await emitAppEvent('tagAttachment.created', { tagAttachment: attachment });
    expect(await memberIds(segment.id)).toEqual([memberRef.id]);

    const tagAttachments = await db.tagAttachment.findMany({ where: { tagId: doomed.id } });
    const deleted = await db.tag.update({ where: { id: doomed.id }, data: { deletedAt: new Date() } });
    await emitAppEvent('tag.deleted', { tag: deleted, tagAttachments });
    expect(await memberIds(segment.id)).toEqual([]);
  });

  it('a user update and a new customer reference reconcile that customer', async () => {
    const segment = await liveSegment(acmeRule);
    const newcomer = (await createUser({ email: `newcomer-${getNextSeq()}@example.test` })).entity;
    const newcomerRef = await customerOf(newcomer);
    await emitAppEvent('customerRef.created', { customerRef: newcomerRef });
    expect(await memberIds(segment.id)).toEqual([]);

    const renamed = await db.user.update({
      where: { id: newcomer.id },
      data: { email: `newcomer-${getNextSeq()}@acme.test` },
    });
    await emitAppEvent('user.updated', { user: renamed });
    expect(await memberIds(segment.id)).toEqual([newcomerRef.id]);

    const joiner = (await createUser({ email: `joiner-${getNextSeq()}@acme.test` })).entity;
    const joinerRef = await customerOf(joiner);
    await emitAppEvent('customerRef.created', { customerRef: joinerRef });
    expect(await memberIds(segment.id)).toEqual([newcomerRef.id, joinerRef.id].sort());
  });
});
