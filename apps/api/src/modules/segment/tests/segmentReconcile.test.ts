import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { clearHookRegistry, db, type Prisma } from '@template/db';
import type { CustomerRef, Organization, Segment, Space, User } from '@template/db/generated/client/client';
import {
  CommunicationKind,
  ContactType,
  ProviderModel,
  SegmentType,
  SenderType,
} from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createCommunicationLog,
  createContact,
  createCustomerRef,
  createOrganizationUser,
  createSegment,
  createSegmentMember,
  createSpace,
  createTag,
  createTagAttachment,
  createUser,
  getNextSeq,
} from '@template/db/test';
import { emitAppEvent } from '#/appEvents/emit';
import { registerSegmentConditionsHook } from '#/hooks/segmentConditions/hook';
import { registerSegmentMemberOwnerHook } from '#/hooks/segmentMemberOwner/hook';
import { registerSegmentRuleReferencesHook } from '#/hooks/segmentRuleReferences/hook';
import { enqueueJob } from '#/jobs/enqueue';
import { evaluateSegment } from '#/modules/segment/services/evaluateSegment';
import { reconcileCustomerRef } from '#/modules/segment/services/reconcileCustomerRef';
import { acmeRule, memberIds } from '#/modules/segment/tests/fixtures';

const idsRule = (ids: string[]) => ({ field: 'id', operator: Operator.in, value: ids });

type SegmentInput = Parameters<typeof createSegment>[0];
type SegmentDeps = Parameters<typeof createSegment>[1];

const saveSegment = async (data: SegmentInput, deps: SegmentDeps): Promise<Segment> => {
  const { entity } = await createSegment(data, deps);
  await emitAppEvent('segment.created', { segment: entity });
  return entity;
};

const updateSegment = async (previous: Segment, data: Prisma.SegmentUncheckedUpdateInput): Promise<Segment> => {
  const segment = await db.segment.update({ where: { id: previous.id }, data });
  await emitAppEvent('segment.updated', { segment, previous });
  return segment;
};

const setEmail = async (user: User, email: string): Promise<void> => {
  await db.user.update({ where: { id: user.id }, data: { email } });
  await enqueueJob('reconcileCustomerRefSegments', { customerModel: 'User', customerId: user.id });
};

describe('segment reconcile', () => {
  let organization: Organization;
  let space: Space;
  let acme: User;
  let other: User;
  let acmeRef: CustomerRef;
  let otherRef: CustomerRef;

  const customerOf = async (user: User, provider: Space = space) =>
    (
      await createCustomerRef({
        customerModel: 'User',
        providerModel: 'Space',
        customerUser: user,
        providerSpace: provider,
      })
    ).entity;

  beforeAll(async () => {
    registerSegmentConditionsHook();
    registerSegmentMemberOwnerHook();
    registerSegmentRuleReferencesHook();

    const { context } = await createOrganizationUser({ role: 'admin' });
    organization = context.organization;
    space = (await createSpace({}, { organization })).entity;
    acme = (await createUser({ email: `acme-${getNextSeq()}@acme.test` })).entity;
    other = (await createUser({ email: `other-${getNextSeq()}@example.test` })).entity;
    acmeRef = await customerOf(acme);
    otherRef = await customerOf(other);
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('a saved segment is not reconciled until its created event fires', async () => {
    const { entity: segment } = await createSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    expect(await memberIds(segment.id)).toEqual([]);

    await emitAppEvent('segment.created', { segment });
    expect(await evaluateSegment(segment)).toEqual([acmeRef.id]);
    expect(await memberIds(segment.id)).toEqual([acmeRef.id]);
  });

  it('does not select customers of another provider', async () => {
    const elsewhere = (await createSpace({}, { organization })).entity;
    const stranger = (await createUser({ email: `stranger-${getNextSeq()}@acme.test` })).entity;
    await customerOf(stranger, elsewhere);

    const segment = await saveSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    expect(await memberIds(segment.id)).toEqual([acmeRef.id]);
  });

  it('a tag rule sees platform tags and the owner’s own, never another owner’s, even by name', async () => {
    const elsewhere = (await createSpace({}, { organization })).entity;
    const theirs = (await createTag({ name: 'vip', ownerModel: 'Space' }, { space: elsewhere })).entity;
    await createTagAttachment({ resourceModel: 'User' }, { user: acme, tag: theirs });
    const byName = {
      field: 'customerUser.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tag.name', operator: Operator.equals, value: 'vip' },
    };
    const segment = await saveSegment({ type: SegmentType.dynamic, conditions: byName }, { space });
    expect(await memberIds(segment.id)).toEqual([]);
    expect(await reconcileCustomerRef(acmeRef.id)).toEqual([]);

    const mine = (await createTag({ name: 'vip', ownerModel: 'Space' }, { space })).entity;
    const { entity: attachment } = await createTagAttachment({ resourceModel: 'User' }, { user: acme, tag: mine });
    await emitAppEvent('tagAttachment.created', { tagAttachment: attachment });
    expect(await memberIds(segment.id)).toEqual([acmeRef.id]);
  });

  it('a static segment is computed when saved and holds until its conditions change', async () => {
    const picked = (await createUser({ email: `picked-${getNextSeq()}@example.test` })).entity;
    const pickedRef = await customerOf(picked);
    const segment = await saveSegment(
      { type: SegmentType.static, conditions: { all: [acmeRule, idsRule([pickedRef.id])] } },
      { space },
    );
    expect(await memberIds(segment.id)).toEqual([]);

    await setEmail(picked, `picked-${getNextSeq()}@acme.test`);
    expect(await memberIds(segment.id)).toEqual([]);
    expect(await reconcileCustomerRef(pickedRef.id)).toEqual([]);

    const repicked = await updateSegment(segment, { conditions: idsRule([pickedRef.id, otherRef.id]) });
    expect(await memberIds(segment.id)).toEqual([pickedRef.id, otherRef.id].sort());

    await updateSegment(repicked, { name: `renamed-${getNextSeq()}` });
    await setEmail(picked, `picked-${getNextSeq()}@example.test`);
    expect(await memberIds(segment.id)).toEqual([pickedRef.id, otherRef.id].sort());
  });

  it('a hand-picked segment only admits the owner’s own customer references', async () => {
    const elsewhere = (await createSpace({}, { organization })).entity;
    const foreignRef = await customerOf(other, elsewhere);
    const segment = await saveSegment(
      { type: SegmentType.static, conditions: idsRule([otherRef.id, foreignRef.id]) },
      { space },
    );
    expect(await memberIds(segment.id)).toEqual([otherRef.id]);

    await expect(createSegmentMember({}, { segment, customerRef: foreignRef })).rejects.toThrow(
      'not a customer of the segment',
    );
  });

  it('a user and an organization segment their own customers', async () => {
    const provider = (await createUser()).entity;
    const viaUser = (
      await createCustomerRef({
        customerModel: 'User',
        providerModel: ProviderModel.User,
        customerUser: acme,
        providerUser: provider,
      })
    ).entity;
    const viaOrganization = (
      await createCustomerRef({
        customerModel: 'User',
        providerModel: ProviderModel.Organization,
        customerUser: acme,
        providerOrganization: organization,
      })
    ).entity;

    const mine = await saveSegment(
      { ownerModel: ProviderModel.User, type: SegmentType.dynamic, conditions: acmeRule },
      { user: provider },
    );
    expect(await memberIds(mine.id)).toEqual([viaUser.id]);

    const ours = await saveSegment(
      { ownerModel: ProviderModel.Organization, type: SegmentType.dynamic, conditions: acmeRule },
      { organization },
    );
    expect(await memberIds(ours.id)).toEqual([viaOrganization.id]);
  });

  it('a customer-side reconcile re-evaluates every reference of that customer, and only those', async () => {
    const segment = await saveSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    const newcomer = (await createUser({ email: `late-${getNextSeq()}@example.test` })).entity;
    const newcomerRef = await customerOf(newcomer);
    expect(await memberIds(segment.id)).toEqual([acmeRef.id]);

    await setEmail(newcomer, `late-${getNextSeq()}@acme.test`);
    expect(await memberIds(segment.id)).toEqual([acmeRef.id, newcomerRef.id].sort());

    await setEmail(newcomer, `gone-${getNextSeq()}@example.test`);
    expect(await memberIds(segment.id)).toEqual([acmeRef.id]);
  });

  it('a contact event reaches the customer reference through the contact owner', async () => {
    const segment = await saveSegment(
      {
        type: SegmentType.dynamic,
        conditions: {
          field: 'customerUser.contacts',
          arrayOperator: 'any',
          condition: { field: 'type', operator: Operator.equals, value: ContactType.phone },
        },
      },
      { space },
    );
    expect(await memberIds(segment.id)).toEqual([]);

    const { entity: contact } = await createContact(
      {
        type: ContactType.phone,
        value: { e164: `+1555${String(getNextSeq()).padStart(7, '0').slice(-7)}`, country: 'US' },
      },
      { user: other },
    );
    expect(await memberIds(segment.id)).toEqual([]);
    await emitAppEvent('contact.created', { contact });
    expect(await memberIds(segment.id)).toEqual([otherRef.id]);

    const deleted = await db.contact.delete({ where: { id: contact.id } });
    await emitAppEvent('contact.deleted', { contact: deleted });
    expect(await memberIds(segment.id)).toEqual([]);
  });

  it('a segment can be built from the membership of another, evaluated in dependency order', async () => {
    const base = await saveSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    const derived = await saveSegment(
      {
        type: SegmentType.dynamic,
        conditions: {
          all: [
            {
              field: 'segmentMembers',
              arrayOperator: 'any',
              condition: { field: 'segment.id', operator: Operator.equals, value: base.id },
            },
            { field: 'customerUser.emailVerified', operator: Operator.equals, value: true },
          ],
        },
      },
      { space },
    );
    expect(await memberIds(derived.id)).toEqual([acmeRef.id]);

    const changes = await reconcileCustomerRef(acmeRef.id);
    expect(changes).toEqual([]);

    await updateSegment(base, {
      conditions: { field: 'customerUser.email', operator: Operator.endsWith, value: '@nobody.test' },
    });
    expect(await memberIds(base.id)).toEqual([]);
    expect(await memberIds(derived.id)).toEqual([]);
  });

  it("a communication from another provider does not satisfy this provider's rule", async () => {
    const segment = await saveSegment(
      {
        type: SegmentType.dynamic,
        conditions: {
          field: 'customerUser.communicationsReceived',
          arrayOperator: 'any',
          condition: { field: 'kind', operator: Operator.equals, value: CommunicationKind.marketing },
        },
      },
      { space },
    );
    const elsewhere = (await createSpace({}, { organization })).entity;
    const foreign = await createCommunicationLog({
      kind: CommunicationKind.marketing,
      senderType: SenderType.Space,
      recipientUser: other,
      senderSpace: elsewhere,
    });
    await emitAppEvent('communication.settled', { communicationLog: foreign.entity });
    expect(await memberIds(segment.id)).toEqual([]);

    const ours = await createCommunicationLog({
      kind: CommunicationKind.marketing,
      senderType: SenderType.Space,
      recipientUser: other,
      senderSpace: space,
    });
    await emitAppEvent('communication.settled', { communicationLog: ours.entity });
    expect(await memberIds(segment.id)).toEqual([otherRef.id]);
  });

  it('a single customer write resolves a segment-of-segment in one pass', async () => {
    const base = await saveSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    const derived = await saveSegment(
      {
        type: SegmentType.dynamic,
        conditions: {
          field: 'segmentMembers',
          arrayOperator: 'any',
          condition: { field: 'segment.id', operator: Operator.equals, value: base.id },
        },
      },
      { space },
    );
    const newcomer = (await createUser({ email: `chain-${getNextSeq()}@example.test` })).entity;
    const newcomerRef = await customerOf(newcomer);
    expect(await memberIds(derived.id)).toEqual([acmeRef.id]);

    await setEmail(newcomer, `chain-${getNextSeq()}@acme.test`);
    expect(await memberIds(base.id)).toEqual([acmeRef.id, newcomerRef.id].sort());
    expect(await memberIds(derived.id)).toEqual([acmeRef.id, newcomerRef.id].sort());

    await setEmail(newcomer, `chain-${getNextSeq()}@example.test`);
    expect(await memberIds(derived.id)).toEqual([acmeRef.id]);
  });

  it('flipping to static keeps the members and stops reacting; flipping back catches up', async () => {
    const segment = await saveSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    expect(await memberIds(segment.id)).toEqual([acmeRef.id]);

    const frozen = await updateSegment(segment, { type: SegmentType.static });
    const newcomer = (await createUser({ email: `frozen-${getNextSeq()}@acme.test` })).entity;
    const newcomerRef = await customerOf(newcomer);
    await enqueueJob('reconcileCustomerRefSegments', { customerModel: 'User', customerId: newcomer.id });
    expect(await memberIds(segment.id)).toEqual([acmeRef.id]);

    await updateSegment(frozen, { type: SegmentType.dynamic });
    expect(await memberIds(segment.id)).toEqual([acmeRef.id, newcomerRef.id].sort());
  });
});
